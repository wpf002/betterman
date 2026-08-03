'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export interface NavDestination {
  href: string;
  label: string;
}

/**
 * Mobile navigation menu.
 *
 * A sheet rather than a bar: the destinations outgrew a phone header, and a
 * reading app spends most of its time with no chrome in the way at all.
 * Closes on Escape and on route change, returns focus to the button, and the
 * button keeps a 44px target.
 */
export function NavMenu({ destinations }: { destinations: NavDestination[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating away should never leave the sheet hanging open behind the page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // The page behind must not scroll while the sheet is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('a')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open menu"
        className="-mr-2 flex h-11 w-11 items-center justify-center sm:hidden"
      >
        <span aria-hidden className="flex w-6 flex-col gap-[5px]">
          <span className="h-px w-full bg-ink" />
          <span className="h-px w-full bg-ink" />
          <span className="h-px w-full bg-ink" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-ink/20"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-x-0 top-0 bg-bone pb-6 shadow-[0_1px_0_var(--hair)]"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <span className="bm-eyebrow">Menu</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                aria-label="Close menu"
                className="-mr-2 flex h-11 w-11 items-center justify-center text-[22px] leading-none text-mute hover:text-ink"
              >
                &times;
              </button>
            </div>

            <nav aria-label="Primary">
              <ul className="border-t border-hair">
                {destinations.map((destination) => (
                  <li key={destination.href} className="border-b border-hair">
                    <Link
                      href={destination.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive(destination.href) ? 'page' : undefined}
                      className={`block px-5 py-5 text-[22px] ${
                        isActive(destination.href) ? 'text-clay-deep' : 'text-ink'
                      }`}
                    >
                      {destination.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
