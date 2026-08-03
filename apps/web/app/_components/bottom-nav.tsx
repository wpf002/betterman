'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Mobile navigation.
 *
 * Five destinations do not fit across a phone's header — they were running off
 * the right edge — and this is an installed reading app, so the thumb-reachable
 * bottom bar is the pattern people already expect. Above `sm` it disappears and
 * the header nav takes over.
 *
 * Labels rather than icons: BetterMan's identity is typographic, and five
 * invented glyphs would be five pieces of brand nobody sampled.
 */
export interface NavDestination {
  href: string;
  label: string;
}

export function BottomNav({ destinations }: { destinations: NavDestination[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-bone/95 backdrop-blur sm:hidden"
      // Clears the iPhone home indicator without padding every other device.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-shell">
        {destinations.map((destination) => {
          const active = isActive(destination.href);
          return (
            <li key={destination.href} className="min-w-0 flex-1">
              <Link
                href={destination.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center px-1 py-3 text-[10px] font-bold uppercase leading-tight tracking-[1px] transition-colors ${
                  active ? 'text-clay-deep' : 'text-mute hover:text-ink'
                }`}
              >
                <span className="truncate">{destination.label}</span>
                {/* A hairline under the active item, in keeping with the rest
                    of the chrome — no pills, no filled tabs. */}
                <span
                  aria-hidden
                  className={`mt-1.5 block h-px w-5 ${active ? 'bg-clay' : 'bg-transparent'}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
