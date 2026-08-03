import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPassagesForBook, slugToBook } from '@/lib/scripture/queries';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = slugToBook(slug);
  return book ? { title: book } : {};
}

/**
 * A book's passages, each linked to the piece that taught it. Flat rather than
 * book → chapter → passage: the middle step carried no information a reader
 * wanted, it was just another tap.
 */
export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = slugToBook(slug);
  if (!book) notFound();

  const passages = await getPassagesForBook(book);
  if (passages.length === 0) notFound();

  return (
    <div className="mx-auto max-w-shell px-5 pb-8 pt-8 sm:pt-14">
      <nav className="mb-8">
        <Link href="/search" className="bm-eyebrow hover:text-ink">
          ← Back
        </Link>
      </nav>

      <h1 className="text-display-sm sm:text-display-md">{book}</h1>

      <ul className="mt-8 border-t border-hair">
        {passages.map((passage) => (
          <li
            key={`${passage.itemId}-${passage.displayRef}`}
            className="border-b border-hair last:border-b-0"
          >
            <Link
              href={passage.href}
              className="group -mx-4 block rounded-sm px-4 py-6 transition-colors hover:bg-paper/70 active:bg-paper sm:-mx-5 sm:px-5"
            >
              <p className="bm-eyebrow">{passage.displayRef}</p>
              <h2 className="mt-2 text-[22px] leading-tight group-hover:text-clay-deep">
                {passage.title}
              </h2>
              <p className="mt-1 text-[15px] text-mute">{passage.publication}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
