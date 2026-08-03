import { redirect } from 'next/navigation';
import { AuthForm } from '../_components/auth-form';
import { getSessionUser } from '@/lib/auth/session';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({
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
        Sign in to keep your <em className="bm-emphasis">place</em>.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        Bookmarks, how far you&rsquo;ve read, and the next steps you&rsquo;ve committed to follow
        you to every device.
      </p>

      <AuthForm mode="sign-in" next={next ?? '/'} />
    </div>
  );
}
