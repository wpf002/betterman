import Link from 'next/link';
import { search } from '@/lib/search/queries';
import { getBooks } from '@/lib/scripture/queries';
import { formatLongDate } from '@/lib/dates';

export const metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

/**
 * Search, with the Scripture index folded in beneath it rather than living on
 * a page of its own — both answer the same question ("where was that?"), and
 * splitting them meant two destinations doing one job.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const [hits, books] = await Promise.all([query ? search(query) : [], getBooks()]);

  return (
    <div className="mx-auto max-w-shell px-5 pb-8 pt-10 sm:pt-16">
      <h1 className="text-display-sm sm:text-display-md">Search</h1>

      {/* A GET form, so a search is a shareable, bookmarkable URL. */}
      <form action="/search" method="get" className="mt-6 max-w-measure">
        <label htmlFor="q" className="sr-only">
          Search all three publications
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={query}
            autoComplete="off"
            className="h-12 w-full border border-hair bg-paper px-4 text-[17px] focus:border-clay focus:outline-none"
          />
          <button
            type="submit"
            className="h-12 shrink-0 border border-ink bg-ink px-5 text-[12px] font-bold uppercase tracking-[2px] text-white transition-colors hover:border-clay-deep hover:bg-clay-deep"
          >
            Go
          </button>
        </div>
      </form>

      {query ? (
        <section className="mt-10">
          <p className="bm-eyebrow">
            {hits.length} {hits.length === 1 ? 'result' : 'results'}
          </p>

          {hits.length === 0 ? (
            <p className="mt-4 max-w-measure text-mute">
              Nothing matched. Try fewer words — or put a phrase in quotes to match it exactly.
            </p>
          ) : (
            <ul className="mt-4 border-t border-hair">
              {hits.map((hit) => (
                <li key={hit.id} className="border-b border-hair">
                  <Link
                    href={hit.href}
                    className="group -mx-4 block rounded-sm px-4 py-6 transition-colors hover:bg-paper/70 active:bg-paper sm:-mx-5 sm:px-5"
                  >
                    <p className="bm-eyebrow">
                      {hit.publication} · {formatLongDate(hit.publishedAt)}
                    </p>
                    <h2 className="mt-2 text-[22px] leading-tight group-hover:text-clay-deep">
                      {hit.title}
                    </h2>

                    {hit.snippet.length > 0 ? (
                      <p className="mt-2 max-w-measure text-[15px] leading-relaxed text-mute">
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
        </section>
      ) : null}

      {/* Every passage ever taught, browsable by book (spec §12). */}
      <section className="mt-14 border-t border-hair pt-10 sm:mt-20">
        <h2 className="text-display-sm">By Scripture</h2>
        <p className="mt-3 max-w-measure text-mute">
          Every passage these publications have taught, by book and chapter.
        </p>

        {books.length === 0 ? (
          <p className="mt-6 max-w-measure text-mute">
            Passages appear here as pieces are ingested.
          </p>
        ) : (
          <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-3">
            {books.map((book) => (
              <li key={book.slug}>
                <Link
                  href={`/scripture/${book.slug}`}
                  className="inline-block border border-hair bg-paper px-4 py-2.5 text-[17px] transition-colors hover:border-clay hover:text-clay-deep"
                >
                  {book.book}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
