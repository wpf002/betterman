import Link from 'next/link';
import { BettermanLockup } from '@betterman/ui';
import { getSessionUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/admin/guard';
import { BottomNav, type NavDestination } from './bottom-nav';

/**
 * App chrome. BetterMan styling only — a source skin never appears up here
 * (spec §13). The lockup rides on every page.
 *
 * On a phone the header is the lockup alone and navigation moves to a bottom
 * bar; five links across a 390px header ran off the edge.
 */
export async function SiteHeader() {
  const [user, admin] = await Promise.all([getSessionUser(), isAdmin()]);

  const destinations: NavDestination[] = [
    { href: '/', label: 'Read' },
    { href: '/search', label: 'Search' },
    { href: '/scripture', label: 'Scripture' },
    user ? { href: '/saved', label: 'Saved' } : { href: '/sign-in', label: 'Sign in' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <>
      <header className="border-b border-hair">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-5 py-5">
          <Link href="/" aria-label="BetterMan Reader — home" className="block shrink-0">
            <BettermanLockup className="h-6 w-auto text-ink" />
          </Link>

          {/* Above `sm` the same destinations sit in the header instead. */}
          <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
            <Link href="/search" className="bm-eyebrow hover:text-ink">
              Search
            </Link>
            <Link href="/scripture" className="bm-eyebrow hover:text-ink">
              Scripture
            </Link>
            {user ? (
              <Link href="/saved" className="bm-eyebrow hover:text-ink">
                Saved
              </Link>
            ) : null}
            {admin ? (
              <Link href="/admin" className="bm-eyebrow hover:text-ink">
                Admin
              </Link>
            ) : null}
            <Link href="/settings" className="bm-eyebrow hover:text-ink">
              Settings
            </Link>
            {!user ? (
              <Link href="/sign-in" className="bm-eyebrow hover:text-ink">
                Sign in
              </Link>
            ) : null}
          </nav>

          {/* Admin has no room in the bottom bar, so on a phone it sits here. */}
          {admin ? (
            <Link href="/admin" className="bm-eyebrow shrink-0 hover:text-ink sm:hidden">
              Admin
            </Link>
          ) : null}
        </div>
      </header>

      <BottomNav destinations={destinations} />
    </>
  );
}
