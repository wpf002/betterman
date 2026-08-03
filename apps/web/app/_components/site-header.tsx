import Link from 'next/link';
import { BettermanLockup } from '@betterman/ui';
import { getSessionUser } from '@/lib/auth/session';

/**
 * App chrome. BetterMan styling only — a source skin never appears up here
 * (spec §13). The lockup rides on every page.
 */
export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-hair">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-5 py-5">
        <Link href="/" aria-label="BetterMan Reader — home" className="block shrink-0">
          <BettermanLockup className="h-6 w-auto text-ink" />
        </Link>

        <nav className="flex items-center gap-5">
          <Link href="/search" className="bm-eyebrow hover:text-ink">
            Search
          </Link>
          <Link href="/scripture" className="bm-eyebrow hidden hover:text-ink sm:block">
            Scripture
          </Link>
          {user ? (
            <Link href="/saved" className="bm-eyebrow hover:text-ink">
              Saved
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
      </div>
    </header>
  );
}
