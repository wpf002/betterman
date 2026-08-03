import Link from 'next/link';
import { search } from '@/lib/search/queries';
import { formatLongDate } from '@/lib/dates';

export const metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const hits = query ? await search(query) : [];

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Search</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">
        Find it <em className="bm-emphasis">again</em>.
      </h1>

      {/* A GET form, so a search is a shareable, bookmarkable URL. */}
      <form action="/search" method="get" className="mt-8 flex max-w-measure gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="A phrase you remember…"
          aria-label="Search all three publications"
          autoComplete="off"
          className="w-full border border-hair bg-paper px-4 py-3 text-[17px] placeholder:text-mute focus:border-clay focus:outline-none"
        />
        <button type="submit" className="bm-button shrink-0 !mt-0">
          Search
        </button>
      </form>

      <p className="mt-3 max-w-measure text-[15px] text-mute">
        Put a phrase in quotes to match it exactly.
      </p>

      {query ? (
        <>
          <p className="bm-eyebrow mt-12">
            {hits.length} {hits.length === 1 ? 'result' : 'results'} for{' '}
            {/* A quoted phrase already carries its own quotes; adding a second
                pair renders as ““living water””. */}
            {/^["“].*["”]$/.test(query) ? query : `“${query}”`}
          </p>

          {hits.length === 0 ? (
            <p className="mt-4 max-w-measure text-mute">
              Nothing matched. Try fewer words, or drop the quotes.
            </p>
          ) : (
            <ul className="mt-4 border-t border-hair">
              {hits.map((hit) => (
                <li key={hit.id} className="border-b border-hair">
                  <Link href={hit.href} className="group block py-6">
                    <p className="bm-eyebrow">
                      {hit.publication} · {formatLongDate(hit.publishedAt)}
                    </p>
                    <h2 className="mt-2 text-[22px] group-hover:text-clay-deep">{hit.title}</h2>

                    {hit.snippet.length > 0 ? (
                      <p className="mt-2 max-w-measure text-[15px] text-mute">
                        {hit.snippet.map((part, i) =>
                          part.match ? (
                            <mark key={i} className="bg-transparent font-bold text-ink">
                              {part.text}
                            </mark>
                          ) : (
                            <span key={i}>{part.text}</span>
                          ),
                        )}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-12 max-w-measure text-mute">
          Search every devotional and article at once — or browse{' '}
          <Link href="/scripture" className="text-clay-deep underline">
            by Scripture
          </Link>
          .
        </p>
      )}
    </div>
  );
}
