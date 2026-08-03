'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordReset, type ResetRequestState } from '@/lib/auth/reset';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bm-button mt-8 disabled:opacity-60">
      {pending ? 'Sending…' : 'Send the link'}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState<ResetRequestState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="mt-10 max-w-measure border-l-2 border-clay bg-paper/70 px-5 py-4">
        <p className="bm-eyebrow">Check your email</p>
        <p className="mt-2 text-[17px]">
          If that address has an account, a reset link is on its way. It works once and expires in
          an hour.
        </p>
        <p className="mt-4 text-[15px] text-mute">
          <Link href="/sign-in" className="text-clay-deep underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 max-w-measure">
      <label className="block">
        <span className="bm-eyebrow">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className="mt-2 w-full border border-hair bg-paper px-4 py-3 text-[17px] placeholder:text-mute focus:border-clay focus:outline-none"
        />
      </label>

      {state.error ? (
        <p role="alert" className="mt-6 border-l-2 border-clay pl-4 text-[15px]">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="mt-8 text-[15px] text-mute">
        Remembered it?{' '}
        <Link href="/sign-in" className="text-clay-deep underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
