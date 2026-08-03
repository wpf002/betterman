import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:https';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The API reads DATABASE_URL and the VAPID keys from the repo-root .env.
const ENV_PATH = resolve(__dirname, '../../../.env');
if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const { ItemStatus, SourceKey, prisma } = await import('@betterman/db');
const { fanOutForItem, localParts } = await import('@betterman/ingest');
const { drainQueue } = await import('../src/push/worker.js');

/**
 * End-to-end delivery, exercised against a mock push service.
 *
 * A real browser subscription cannot be created headlessly, but everything
 * downstream of it is real: VAPID signing, payload encryption, the HTTPS POST,
 * the timezone maths and the once-per-publication-per-day debounce. The mock
 * stands in only for Apple's and Google's endpoints.
 *
 * It has to speak TLS — web-push refuses plaintext, which is correct of it —
 * so the suite mints a throwaway self-signed certificate for 127.0.0.1.
 */

interface Received {
  path: string;
  bytes: number;
  auth: string | undefined;
}

let server: Server;
let received: Received[] = [];
let baseUrl = '';

const TEST_EMAILS = [
  'tz-chicago@test.invalid',
  'tz-london@test.invalid',
  'tz-tokyo@test.invalid',
  'tz-off@test.invalid',
];

/** A valid P-256 subscription key pair shape; contents need not decrypt here. */
const FAKE_KEYS = {
  p256dh:
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.pendingNotification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pushLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPref.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.item.deleteMany({ where: { externalId: { startsWith: 'push-test-' } } });
}

/** A throwaway localhost certificate, valid only for this process. */
function selfSignedCert(): { key: string; cert: string } {
  const dir = mkdtempSync(join(tmpdir(), 'bm-push-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-subj', '/CN=127.0.0.1',
  ], { stdio: 'ignore' });

  return { key: readFileSync(keyPath, 'utf8'), cert: readFileSync(certPath, 'utf8') };
}

beforeAll(async () => {
  // The mock's certificate is self-signed by definition.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  server = createServer(selfSignedCert(), (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({
        path: req.url ?? '',
        bytes: Buffer.concat(chunks).length,
        auth: req.headers.authorization,
      });
      res.writeHead(201).end();
    });
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `https://127.0.0.1:${port}`;

  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await new Promise<void>((r) => server.close(() => r()));
  await prisma.$disconnect();
});

describe('push delivery, end to end', () => {
  it('queues per timezone, honours toggles, sends once, then debounces', async () => {
    const devotional = await prisma.source.findUniqueOrThrow({
      where: { key: SourceKey.BETTERMORNINGS },
    });

    // Four readers: three subscribed in different zones, one opted out.
    const setup: Array<[email: string, timezone: string, enabled: boolean]> = [
      ['tz-chicago@test.invalid', 'America/Chicago', true],
      ['tz-london@test.invalid', 'Europe/London', true],
      ['tz-tokyo@test.invalid', 'Asia/Tokyo', true],
      ['tz-off@test.invalid', 'America/Chicago', false],
    ];

    for (const [email, timezone, enabled] of setup) {
      const user = await prisma.user.create({
        data: { email, timezone },
        select: { id: true },
      });
      await prisma.notificationPref.create({
        data: { userId: user.id, sourceId: devotional.id, enabled, deliverHour: 6 },
      });
      await prisma.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint: `${baseUrl}/push/${encodeURIComponent(email)}`,
          ...FAKE_KEYS,
        },
      });
    }

    const item = await prisma.item.create({
      data: {
        sourceId: devotional.id,
        externalId: 'push-test-0001',
        slug: 'push-test-0001',
        title: 'A Test Devotional',
        publishedAt: new Date(),
        contentHtml: '<p>body</p>',
        contentHash: 'push-test-hash',
        status: ItemStatus.PUBLISHED,
      },
      select: { id: true },
    });

    // --- Ingest fans out -------------------------------------------------
    const fan = await fanOutForItem(item.id);
    expect(fan.queued).toBe(3); // the opted-out reader is never queued

    const queued = await prisma.pendingNotification.findMany({
      where: { itemId: item.id },
      select: { deliverAfter: true, user: { select: { email: true, timezone: true } } },
    });
    expect(queued).toHaveLength(3);

    // Each row lands at 6am in that reader's own zone, or immediately if their
    // morning has already passed.
    for (const row of queued) {
      const zone = row.user.timezone;
      const hour = localParts(row.deliverAfter, zone).hour;
      const immediate = row.deliverAfter.getTime() <= Date.now() + 1000;
      expect(hour === 6 || immediate).toBe(true);
    }

    // --- The worker delivers ---------------------------------------------
    // Force every row due, so the test does not depend on the wall clock.
    await prisma.pendingNotification.updateMany({
      where: { itemId: item.id },
      data: { deliverAfter: new Date(Date.now() - 60_000) },
    });

    received = [];
    const first = await drainQueue();

    expect(first.sent).toBe(3);
    expect(received).toHaveLength(3);

    // Real Web Push: VAPID-signed and encrypted, not a bare JSON body.
    for (const r of received) {
      expect(r.auth ?? '').toMatch(/^vapid /i);
      expect(r.bytes).toBeGreaterThan(0);
    }

    // --- Debounce ---------------------------------------------------------
    // A second piece from the same publication on the same local day must not
    // produce a second push (spec §10).
    const second = await prisma.item.create({
      data: {
        sourceId: devotional.id,
        externalId: 'push-test-0002',
        slug: 'push-test-0002',
        title: 'A Second Devotional, Same Day',
        publishedAt: new Date(),
        contentHtml: '<p>body</p>',
        contentHash: 'push-test-hash-2',
        status: ItemStatus.PUBLISHED,
      },
      select: { id: true },
    });

    await fanOutForItem(second.id);
    await prisma.pendingNotification.updateMany({
      where: { itemId: second.id },
      data: { deliverAfter: new Date(Date.now() - 60_000) },
    });

    received = [];
    const third = await drainQueue();

    expect(third.sent).toBe(0);
    expect(third.debounced).toBe(3);
    expect(received).toHaveLength(0);
  }, 60_000);

  it('never notifies for a piece held in review', async () => {
    const devotional = await prisma.source.findUniqueOrThrow({
      where: { key: SourceKey.BETTERMORNINGS },
    });

    const held = await prisma.item.create({
      data: {
        sourceId: devotional.id,
        externalId: 'push-test-review',
        slug: 'push-test-review',
        title: 'Held For Review',
        publishedAt: new Date(),
        contentHtml: '<p>body</p>',
        contentHash: 'push-test-hash-3',
        status: ItemStatus.REVIEW,
      },
      select: { id: true },
    });

    const fan = await fanOutForItem(held.id);
    expect(fan.queued).toBe(0);
  });
});
