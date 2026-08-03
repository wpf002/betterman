import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChapter, slugToBook } from '@/lib/scripture/queries';
import { formatLongDate } from '@/lib/dates';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: slug, chapter } = await params;
  const book = slugToBook(slug);
  return book ? { title: `${book} ${chapter}` } : {};
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: slug, chapter: rawChapter } = await params;

  const book = slugToBook(slug);
  const chapter = Number(rawChapter);
  if (!book || !Number.isInteger(chapter) || chapter < 1) notFound();

  const entries = await getChapter(book, chapter);
  if (entries.length === 0) notFound();

  const primary = entries.filter((e) => e.isPrimary);
  const mentioned = entries.filter((e) => !e.isPrimary);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <nav className="mb-8">
        <Link href={`/scripture/${slug}`} className="bm-eyebrow hover:text-ink">
          ← {book}
        </Link>
      </nav>

      <h1 className="text-display-sm sm:text-display-md">
        {book} {chapter}
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        {entries.length} {entries.length === 1 ? 'piece' : 'pieces'} from this chapter.
      </p>

      {primary.length > 0 ? (
        <section className="mt-10">
          <h2 className="bm-eyebrow">Built on this passage</h2>
          <PassageList entries={primary} />
        </section>
      ) : null}

      {mentioned.length > 0 ? (
        <section className="mt-12">
          <h2 className="bm-eyebrow">Also cites it</h2>
          <PassageList entries={mentioned} />
        </section>
      ) : null}
    </div>
  );
}

function PassageList({
  entries,
}: {
  entries: Awaited<ReturnType<typeof getChapter>>;
}) {
  return (
    <ul className="mt-4 border-t border-hair">
      {entries.map((entry) => (
        <li key={`${entry.itemId}-${entry.displayRef}`} className="border-b border-hair">
          <Link href={entry.href} className="group block py-6">
            <p className="bm-eyebrow">
              {entry.displayRef} · {entry.publication} · {formatLongDate(entry.publishedAt)}
            </p>
            <h3 className="mt-2 text-[22px] group-hover:text-clay-deep">{entry.title}</h3>
          </Link>
        </li>
      ))}
    </ul>
  );
}
