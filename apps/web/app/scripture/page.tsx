import Link from 'next/link';
import { getBooks } from '@/lib/scripture/queries';

export const metadata = {
  title: 'Scripture',
  description: 'Every passage ever taught, browsable by book and chapter.',
};
export const revalidate = 300;

export default async function ScriptureIndexPage() {
  const books = await getBooks();
  const passages = books.reduce((sum, b) => sum + b.passages, 0);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Scripture</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        Every passage ever <em className="bm-emphasis">taught</em>.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        {passages} {passages === 1 ? 'passage' : 'passages'} across {books.length}{' '}
        {books.length === 1 ? 'book' : 'books'}, in canonical order.
      </p>

      {books.length === 0 ? (
        <p className="mt-10 max-w-measure text-mute">
          Nothing indexed yet. Passages appear here as devotionals are ingested.
        </p>
      ) : (
        <ul className="mt-10 border-t border-hair">
          {books.map((book) => (
            <li key={book.slug} className="border-b border-hair">
              <Link href={`/scripture/${book.slug}`} className="group block py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[22px] group-hover:text-clay-deep">{book.book}</h2>
                  <span className="bm-eyebrow shrink-0">
                    {book.passages} {book.passages === 1 ? 'passage' : 'passages'}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-mute">
                  {book.chapters.length === 1
                    ? `Chapter ${book.chapters[0]}`
                    : `Chapters ${book.chapters.join(', ')}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
