import { redirect } from 'next/navigation';
import { AuthForm } from '../_components/auth-form';
import { getSessionUser } from '@/lib/auth/session';

export const metadata = { title: 'Create account' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next ?? '/');

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Your reading</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        Create an <em className="bm-emphasis">account</em>.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        So your bookmarks and saved next steps are waiting on whichever device you pick up.
      </p>

      <AuthForm mode="sign-up" next={next ?? '/'} />
    </div>
  );
}
