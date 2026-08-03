import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@betterman/db';

/**
 * Session handling.
 *
 * The cookie carries a random 256-bit token; the database stores only its
 * SHA-256, so a leaked table cannot be replayed as a login. This is the whole
 * auth boundary — swapping in SSO against betterman.com later means changing
 * how `createSession` is reached, not how bookmarks or saved steps are read.
 */

const COOKIE_NAME = 'bm_session';
const SESSION_DAYS = 60;
/** Refresh the expiry at most once a day, to avoid a write on every request. */
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * The signed-in user, or null. Wrapped in React's `cache` so several server
 * components on one page share a single query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, email: true, name: true, timezone: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry, so a daily reader is never signed out mid-habit.
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(),
          expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
        },
      })
      .catch(() => undefined);
  }

  return session.user;
});

/** Signs out this device only; other devices keep their sessions. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(COOKIE_NAME);
}

/** Housekeeping — expired rows serve no purpose. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
