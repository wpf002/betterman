import type { FastifyInstance } from 'fastify';
import { IngestStatus, SourceKey, prisma } from '@betterman/db';
import {
  finishRun,
  ingestDevotionalEmail,
  isBettermorningsEmail,
  parseMime,
  startRun,
  storeRawPayload,
} from '@betterman/ingest';
import { env } from '../env.js';

/**
 * Inbound mail webhook. The dedicated BetterMornings mailbox POSTs raw MIME
 * here; ingest is idempotent, so a redelivery is harmless (spec §9/§13).
 */
export async function ingestRoutes(app: FastifyInstance) {
  // Raw MIME arrives as a body the JSON parser must not touch.
  app.addContentTypeParser(
    ['message/rfc822', 'text/plain'],
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  app.post('/ingest/email', async (req, reply) => {
    if (!env.ingestEmailSecret) {
      return reply.code(503).send({ error: 'INGEST_EMAIL_SECRET is not configured' });
    }
    if (req.headers['x-ingest-secret'] !== env.ingestEmailSecret) {
      return reply.code(401).send({ error: 'bad or missing x-ingest-secret' });
    }

    const raw =
      typeof req.body === 'string'
        ? req.body
        : ((req.body as { raw?: string } | undefined)?.raw ?? '');

    if (!raw.trim()) return reply.code(400).send({ error: 'empty body' });

    const mail = await parseMime(raw);
    if (!isBettermorningsEmail(mail)) {
      // Not a devotional. Accept it so the forwarder does not retry, but do
      // nothing with it.
      return reply.code(202).send({ status: 'ignored', reason: 'not a BetterMornings devotional' });
    }
    if (!mail.html) return reply.code(422).send({ error: 'no HTML part' });

    const source = await prisma.source.findUniqueOrThrow({
      where: { key: SourceKey.BETTERMORNINGS },
    });

    const run = await startRun(source.id, 'email-webhook');
    try {
      await storeRawPayload({
        sourceId: source.id,
        runId: run.id,
        kind: 'email-mime',
        externalId: mail.messageId,
        body: raw,
      });

      const result = await ingestDevotionalEmail(source, mail.html, {
        messageId: mail.messageId ?? undefined,
        receivedAt: mail.date ?? undefined,
      });

      await finishRun(
        run.id,
        {
          seen: 1,
          created: result.outcome === 'created' ? 1 : 0,
          updated: result.outcome === 'updated' ? 1 : 0,
          skipped: result.outcome === 'unchanged' ? 1 : 0,
          inReview: result.status === 'REVIEW' ? 1 : 0,
        },
        IngestStatus.SUCCESS,
      );

      return reply.code(result.outcome === 'created' ? 201 : 200).send({
        status: result.outcome,
        date: result.dateKey,
        parseQuality: result.parseQuality,
        // Below 0.9 the piece is held for the review queue rather than published.
        held: result.status === 'REVIEW',
      });
    } catch (err) {
      await finishRun(run.id, { seen: 1, created: 0, updated: 0, skipped: 0, inReview: 0 }, IngestStatus.FAILED, String(err));
      req.log.error({ err }, 'devotional ingest failed');
      return reply.code(500).send({ error: 'ingest failed' });
    }
  });
}
