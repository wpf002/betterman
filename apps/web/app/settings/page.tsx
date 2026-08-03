import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLICATIONS } from '@/lib/publications';
import { IosInstallNotice } from '../_components/ios-install-notice';
import { getSessionUser } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/actions';

/**
 * Settings shell — one notification toggle per publication (spec §10). A
 * reader can take all three or just one.
 *
 * Phase 2 lands the surface; the toggles are inert until Phase 6 wires Web
 * Push, so they are rendered disabled rather than pretending to work.
 */
export const metadata: Metadata = {
  title: 'Settings',
  description: 'Choose which publications notify you.',
};

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Settings</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">Notifications</h1>
      <p className="mt-4 max-w-measure text-mute">
        Get a notification when a new piece lands. Take all three, or just the one you read.
      </p>

      <IosInstallNotice />

      <ul className="mt-10 border-t border-hair sm:mt-12">
        {PUBLICATIONS.map((pub) => (
          <li
            key={pub.slug}
            className="flex items-center justify-between gap-6 border-b border-hair py-6"
          >
            <div>
              <h2 className="text-[20px] font-normal leading-tight">{pub.name}</h2>
              <p className="mt-1 text-[15px] text-mute">{pub.cadence}</p>
            </div>

            {/* Inert until Phase 6. Disabled rather than fake. */}
            <label className="flex shrink-0 items-center gap-3">
              <span className="sr-only">Notify me about {pub.name}</span>
              <input
                type="checkbox"
                disabled
                className="h-5 w-5 shrink-0 accent-clay disabled:cursor-not-allowed"
              />
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-measure text-[15px] text-mute">
        Notification delivery arrives in a later release. Nothing is sent yet.
      </p>

      <section className="mt-16 border-t border-hair pt-8">
        <h2 className="bm-eyebrow">Account</h2>

        {user ? (
          <>
            <p className="mt-4 text-[17px]">{user.email}</p>
            <p className="mt-1 text-[15px] text-mute">
              Your bookmarks, progress and saved steps follow this account across devices.
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="mt-6 rounded-pill border border-hair px-5 py-2.5 text-[12px] font-bold uppercase tracking-[2px] text-mute transition-colors hover:border-clay hover:text-clay-deep"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 max-w-measure text-mute">
            <Link href="/sign-in?next=%2Fsettings" className="text-clay-deep underline">
              Sign in
            </Link>{' '}
            to keep your bookmarks and saved next steps.
          </p>
        )}
      </section>
    </div>
  );
}
