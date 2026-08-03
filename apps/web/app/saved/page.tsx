import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { getBookmarks } from '@/lib/reading/queries';

export const metadata = { title: 'Saved' };
export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=%2Fsaved');

  const bookmarks = await getBookmarks(user.id);

  return (
    <div className="mx-auto max-w-shell px-5 py-8 sm:py-14">
      <nav className="mb-8">
        <Link href="/" className="bm-eyebrow hover:text-ink">
          ← All publications
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
            <li key={piece.itemId} className="border-b border-hair">
              <Link
                href={piece.href}
                className="group -mx-4 block rounded-sm px-4 py-6 transition-colors hover:bg-paper/70 active:bg-paper sm:-mx-5 sm:px-5"
              >
                <p className="bm-eyebrow">
                  {piece.publication} · {piece.dateLabel}
                </p>
                <h2 className="mt-2 text-[22px] leading-tight group-hover:text-clay-deep">
                  {piece.title}
                </h2>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
