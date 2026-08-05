import Link from 'next/link';
import { BettermanLockup } from '@betterman/ui';
import { getSessionUser } from '@/lib/auth/session';
import { NavMenu, type NavDestination } from './nav-menu';

/**
 * App chrome. BetterMan styling only — a source skin never appears up here
 * (spec §13). The lockup rides on every page.
 *
 * Mobile first: on a phone the header is the lockup and a menu button, and
 * every destination lives behind it. The inline nav only appears once there is
 * room for it.
 */
export async function SiteHeader() {
  const user = await getSessionUser();

  const destinations: NavDestination[] = [
    { href: '/', label: 'Read' },
    { href: '/search', label: 'Search' },
    ...(user ? [{ href: '/saved', label: 'Saved' }] : []),
    { href: '/settings', label: 'Settings' },
    ...(user ? [] : [{ href: '/sign-in', label: 'Sign in' }]),
  ];

  return (
    <header className="border-b border-hair">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-5 py-5">
        <Link href="/" aria-label="BetterMan Reader — home" className="block shrink-0">
          <BettermanLockup className="h-6 w-auto text-ink" />
        </Link>

        {/* The same destinations the menu carries, in the same order — Read
            included. Dropping it on desktop left the logo as the only way home,
            which is not obviously a link. */}
        <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
          {destinations.map((destination) => (
            <Link key={destination.href} href={destination.href} className="bm-eyebrow hover:text-ink">
              {destination.label}
            </Link>
          ))}
        </nav>

        <NavMenu destinations={destinations} />
      </div>
    </header>
  );
}
