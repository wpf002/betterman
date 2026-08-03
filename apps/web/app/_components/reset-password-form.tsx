'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { completePasswordReset, type ResetState } from '@/lib/auth/reset';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/rules';

const FIELD =
  'mt-2 w-full border border-hair bg-paper px-4 py-3 text-[17px] focus:border-clay focus:outline-none';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bm-button mt-8 disabled:opacity-60">
      {pending ? 'Saving…' : 'Save new password'}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<ResetState, FormData>(completePasswordReset, {});

  return (
    <form action={formAction} className="mt-10 max-w-measure">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="bm-eyebrow">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          className={FIELD}
        />
        <span className="mt-2 block text-[15px] text-mute">
          At least {PASSWORD_MIN_LENGTH} characters.
        </span>
      </label>

      <label className="mt-6 block">
        <span className="bm-eyebrow">Type it again</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          className={FIELD}
        />
      </label>

      {state.error ? (
        <p role="alert" className="mt-6 border-l-2 border-clay pl-4 text-[15px]">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
