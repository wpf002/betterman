/**
 * Site footer, carrying BetterMan's own copyright and privacy link — this app
 * publishes their material, so it carries their notice.
 *
 * One line, and close to the content above it: a tall gap before a two-line
 * footer reads as the page having ended twice.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-hair">
      <p className="mx-auto flex max-w-shell flex-wrap items-center justify-center gap-x-2 px-5 py-5 text-[13px] text-mute">
        <span>&copy; {new Date().getFullYear()} BetterMan. All rights reserved.</span>
        <span aria-hidden>·</span>
        <a
          href="https://betterman.com/privacy-policy?hsLang=en"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          Privacy Policy
        </a>
      </p>
    </footer>
  );
}
