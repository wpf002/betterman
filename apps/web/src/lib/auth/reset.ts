'use server';

import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@betterman/db';
import { hashPassword } from './password';
import { isValidEmail, normalizeEmail, validatePassword } from './rules';
import { createSession } from './session';
import { sendMail } from '../mail/send';
import { passwordResetEmail } from '../mail/templates';

/**
 * Password reset.
 *
 * Three properties this flow has to hold:
 *
 *   - It must not reveal who has an account. The request page answers
 *     identically whether or not the email exists.
 *   - A link must be single-use and short-lived, and only its hash is stored,
 *     so a leaked table cannot be turned into account takeovers.
 *   - Resetting must sign out every other device. If the reset happened
 *     because someone else had the password, leaving their sessions alive
 *     defeats the point.
 */

const TOKEN_TTL_MINUTES = 60;
/** More than this many live requests for one account is abuse, not a person. */
const MAX_LIVE_TOKENS = 5;

export interface ResetRequestState {
  sent?: boolean;
  error?: string;
}

export interface ResetState {
  error?: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function baseUrl(host: string | null, proto: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (host) return `${proto ?? 'http'}://${host}`;
  return 'http://localhost:3000';
}

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Answer the same either way, and take roughly the same time, so this page
  // cannot be used to discover which addresses are registered.
  if (user) {
    const live = await prisma.passwordResetToken.count({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (live < MAX_LIVE_TOKENS) {
      const headerList = await headers();
      const token = randomBytes(32).toString('base64url');

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
          requestedIp:
            headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            headerList.get('x-real-ip') ??
            null,
        },
      });

      const url = `${baseUrl(headerList.get('host'), headerList.get('x-forwarded-proto'))}/reset-password?token=${token}`;
      const message = passwordResetEmail(url, TOKEN_TTL_MINUTES);
      const result = await sendMail({ ...message, to: email });

      if (!result.ok) {
        // Worth surfacing: a silent failure here strands the reader entirely.
        console.error('password reset mail failed:', result.error);
      }
    }
  }

  return { sent: true };
}

export type TokenCheck =
  | { valid: true; userId: string }
  | { valid: false; reason: 'unknown' | 'expired' | 'used' };

export async function checkResetToken(token: string): Promise<TokenCheck> {
  if (!token) return { valid: false, reason: 'unknown' };

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, expiresAt: true, usedAt: true },
  });

  if (!row) return { valid: false, reason: 'unknown' };
  if (row.usedAt) return { valid: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { valid: false, reason: 'expired' };

  return { valid: true, userId: row.userId };
}

export async function completePasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password !== confirm) return { error: 'Those two passwords do not match.' };

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const check = await checkResetToken(token);
  if (!check.valid) {
    return {
      error:
        check.reason === 'expired'
          ? 'That link has expired. Ask for a new one.'
          : check.reason === 'used'
            ? 'That link has already been used. Ask for a new one.'
            : 'That link is not valid. Ask for a new one.',
    };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: check.userId }, data: { passwordHash } }),
    // Single use.
    prisma.passwordResetToken.update({
      where: { tokenHash: hashToken(token) },
      data: { usedAt: new Date() },
    }),
    // Any other outstanding link is now moot.
    prisma.passwordResetToken.updateMany({
      where: { userId: check.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    // Sign out everywhere. If the reset happened because someone else had the
    // password, leaving their session alive would defeat the whole exercise.
    prisma.session.deleteMany({ where: { userId: check.userId } }),
  ]);

  // Then sign this device back in, so the reader lands somewhere useful.
  const headerList = await headers();
  await createSession(check.userId, headerList.get('user-agent'));

  redirect('/?reset=done');
}
