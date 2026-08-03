import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { getBookmarks } from '@/lib/reading/queries';
import { toggleBookmark } from '@/lib/reading/actions';

export const metadata = { title: 'Saved' };
export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=%2Fsaved');

  const bookmarks = await getBookmarks(user.id);

  return (
    <div className="mx-auto max-w-shell px-5 pb-8 pt-8 sm:pt-14">
      <nav className="mb-8">
        <Link href="/" className="bm-eyebrow hover:text-ink">
          ← Back
        </Link>
      </nav>

      <h1 className="text-display-sm sm:text-display-md">Saved</h1>
      <p className="mt-4 max-w-measure text-mute">Pieces you kept to come back to.</p>

      {bookmarks.length === 0 ? (
        <p className="mt-10 max-w-measure text-mute">
          Nothing saved yet. Open a piece and tap <em className="bm-emphasis">Bookmark</em>.
        </p>
      ) : (
        <ul className="mt-10 border-t border-hair">
          {bookmarks.map((piece) => (
            <li
              key={piece.itemId}
              className="flex items-start gap-3 border-b border-hair last:border-b-0"
            >
              <Link
                href={piece.href}
                className="group -ml-4 min-w-0 flex-1 rounded-sm px-4 py-6 transition-colors hover:bg-paper/70 active:bg-paper sm:-ml-5 sm:pl-5"
              >
                <p className="bm-eyebrow">
                  {piece.publication} · {piece.dateLabel}
                </p>
                <h2 className="mt-2 text-[22px] leading-tight group-hover:text-clay-deep">
                  {piece.title}
                </h2>
              </Link>

              {/* Removing is the same toggle the reading page uses, so a
                  bookmark cannot end up in two different states. */}
              <form action={toggleBookmark.bind(null, piece.itemId, '/saved')} className="pt-6">
                <button
                  type="submit"
                  aria-label={`Remove bookmark: ${piece.title}`}
                  className="flex h-11 w-11 items-center justify-center text-[20px] leading-none text-mute transition-colors hover:text-clay-deep"
                >
                  &times;
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
