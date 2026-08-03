import Link from 'next/link';
import { checkResetToken } from '@/lib/auth/reset';
import { ResetPasswordForm } from '../_components/reset-password-form';

export const metadata = { title: 'Choose a new password' };
export const dynamic = 'force-dynamic';

const REASONS: Record<string, string> = {
  expired: 'That link has expired — they only last an hour.',
  used: 'That link has already been used.',
  unknown: 'That link is not valid.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = await checkResetToken(token ?? '');

  if (!check.valid) {
    return (
      <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
        <p className="bm-eyebrow">Account</p>
        <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
          This link won&rsquo;t <em className="bm-emphasis">work</em>.
        </h1>
        <p className="mt-4 max-w-measure text-mute">
          {REASONS[check.reason] ?? REASONS.unknown} Ask for a new one and it will arrive in a
          moment.
        </p>
        <Link href="/forgot-password" className="bm-button mt-8">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Account</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        Choose a new <em className="bm-emphasis">password</em>.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        This signs you out on every other device.
      </p>

      <ResetPasswordForm token={token ?? ''} />
    </div>
  );
}
