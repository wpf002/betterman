import Link from 'next/link';
import { toggleBookmark } from '@/lib/reading/actions';
import type { ReaderState } from '@/lib/reading/queries';

/**
 * The reader's own actions on a piece, in BetterMan chrome below the panel.
 *
 * Deliberately outside the source panel: a bookmark is ours, not BetterMan's
 * or Substack's, and putting it inside would mix chrome into a skin (spec §13).
 */
export function ReaderControls({
  itemId,
  path,
  state,
  signedIn,
}: {
  itemId: string;
  path: string;
  state: ReaderState;
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <p className="text-[15px] text-mute">
        <Link
          href={`/sign-in?next=${encodeURIComponent(path)}`}
          className="text-clay-deep underline"
        >
          Sign in
        </Link>{' '}
        to bookmark this and save your next step.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={toggleBookmark.bind(null, itemId, path)}>
        <button
          type="submit"
          aria-pressed={state.bookmarked}
          className={`rounded-pill border px-5 py-2.5 text-[12px] font-bold uppercase tracking-[2px] transition-colors ${
            state.bookmarked
              ? 'border-clay bg-clay text-white hover:bg-clay-deep'
              : 'border-hair text-mute hover:border-clay hover:text-clay-deep'
          }`}
        >
          {state.bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </form>

    </div>
  );
}
