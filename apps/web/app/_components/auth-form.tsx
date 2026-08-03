'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthState } from '@/lib/auth/actions';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/rules';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bm-button mt-8 disabled:opacity-60">
      {pending ? 'One moment…' : label}
    </button>
  );
}

const FIELD =
  'mt-2 w-full border border-hair bg-paper px-4 py-3 text-[17px] text-ink placeholder:text-mute focus:border-clay focus:outline-none';

export function AuthForm({ mode, next }: { mode: 'sign-in' | 'sign-up'; next: string }) {
  const action = mode === 'sign-in' ? signIn : signUp;
  const [state, formAction] = useFormState<AuthState, FormData>(action, {});

  return (
    <form action={formAction} className="mt-10 max-w-measure">
      <input type="hidden" name="next" value={next} />

      {mode === 'sign-up' ? (
        <label className="block">
          <span className="bm-eyebrow">Name (optional)</span>
          <input name="name" type="text" autoComplete="name" className={FIELD} />
        </label>
      ) : null}

      <label className="mt-6 block">
        <span className="bm-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className={FIELD}
        />
      </label>

      <label className="mt-6 block">
        <span className="bm-eyebrow">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === 'sign-up' ? PASSWORD_MIN_LENGTH : undefined}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          className={FIELD}
        />
        {mode === 'sign-up' ? (
          <span className="mt-2 block text-[15px] text-mute">
            At least {PASSWORD_MIN_LENGTH} characters.
          </span>
        ) : null}
      </label>

      {state.error ? (
        <p role="alert" className="mt-6 border-l-2 border-clay pl-4 text-[15px] text-ink">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={mode === 'sign-in' ? 'Sign in' : 'Create account'} />

      {mode === 'sign-in' ? (
        <p className="mt-6 text-[15px]">
          <Link href="/forgot-password" className="text-clay-deep underline">
            Forgotten your password?
          </Link>
        </p>
      ) : null}

      <p className="mt-8 text-[15px] text-mute">
        {mode === 'sign-in' ? (
          <>
            No account yet?{' '}
            <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="text-clay-deep underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have one?{' '}
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-clay-deep underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
