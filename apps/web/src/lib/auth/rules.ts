/**
 * Credential rules shared by the server actions and the sign-up form.
 *
 * Deliberately free of Node built-ins: the form is a client component, and
 * importing these from the hashing module dragged `node:crypto` into the
 * browser bundle and broke the build.
 */

export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 200;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return 'That password is too long.';
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
