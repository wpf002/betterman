import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChaptersFor, slugToBook } from '@/lib/scripture/queries';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = slugToBook(slug);
  return book ? { title: book } : {};
}

export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: slug } = await params;
  const book = slugToBook(slug);
  if (!book) notFound();

  const chapters = await getChaptersFor(book);
  if (chapters.length === 0) notFound();

  return (
    <div className="mx-auto max-w-shell px-5 py-10 sm:py-16">
      <nav className="mb-8">
        <Link href="/search" className="bm-eyebrow hover:text-ink">
          ← Search
        </Link>
      </nav>

      <h1 className="text-display-sm sm:text-display-md">{book}</h1>
      <p className="mt-4 max-w-measure text-mute">
        {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} taught.
      </p>

      <ul className="mt-10 border-t border-hair">
        {chapters.map(({ chapter, count }) => (
          <li key={chapter} className="border-b border-hair">
            <Link
              href={`/scripture/${slug}/${chapter}`}
              className="group flex items-baseline justify-between gap-4 py-5"
            >
              <span className="text-[22px] group-hover:text-clay-deep">
                {book} {chapter}
              </span>
              <span className="bm-eyebrow shrink-0">
                {count} {count === 1 ? 'piece' : 'pieces'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
