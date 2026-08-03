import Link from 'next/link';
import { BettermanLockup } from '@betterman/ui';

/**
 * App chrome. BetterMan styling only — a source skin never appears up here
 * (spec §13). The lockup rides on every page.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-hair">
      <div className="mx-auto flex max-w-shell items-center justify-between px-5 py-5">
        <Link href="/" aria-label="BetterMan Reader — home" className="block">
          <BettermanLockup className="h-6 w-auto text-ink" />
        </Link>
        <Link href="/settings" className="bm-eyebrow hover:text-ink">
          Settings
        </Link>
      </div>
    </header>
  );
}
