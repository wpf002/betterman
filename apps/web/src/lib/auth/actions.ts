'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@betterman/db';
import { hashPassword, verifyPassword } from './password';
import { isValidEmail, normalizeEmail, validatePassword } from './rules';
import { createSession, destroySession, getSessionUser } from './session';

export interface AuthState {
  error?: string;
}

/** Where to send the reader after signing in. Same-origin paths only. */
function safeRedirect(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  // An open redirect would let a phishing link bounce through our sign-in.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim() || null;
  const next = safeRedirect(formData.get('next'));

  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: 'An account already exists for that email. Try signing in.' };
  }

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
    select: { id: true },
  });

  const headerList = await headers();
  await createSession(user.id, headerList.get('user-agent'));

  redirect(next);
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const next = safeRedirect(formData.get('next'));

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // One message for both "no such account" and "wrong password", so the form
  // cannot be used to discover which addresses are registered.
  const generic = { error: 'That email and password do not match.' };

  if (!user?.passwordHash) {
    // Still spend the time hashing, so a missing account is not detectably
    // faster than a wrong password.
    await hashPassword(password);
    return generic;
  }

  if (!(await verifyPassword(password, user.passwordHash))) return generic;

  const headerList = await headers();
  await createSession(user.id, headerList.get('user-agent'));

  redirect(next);
}

export async function signOut(): Promise<void> {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/');
}

/** Server-action guard: the signed-in user, or a redirect to sign in. */
export async function requireUser(returnTo: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}
