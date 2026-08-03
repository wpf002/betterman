import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArchiveList } from '../_components/archive-list';
import { getPublication } from '@/lib/publications';
import { getArchive } from '@/lib/queries';

/**
 * One archive per publication. Three surfaces, never merged (spec §2).
 * Rendered in BetterMan chrome; the source skin appears only on the reading
 * page inside the 600px panel.
 */
export const dynamic = 'force-dynamic';

/** Long enough to feel like an archive, short enough to load on a phone. */
const PER_PAGE = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publication: string }>;
}): Promise<Metadata> {
  const { publication } = await params;
  const pub = getPublication(publication);
  if (!pub) return {};
  return { title: pub.name, description: pub.blurb };
}

export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ publication: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { publication } = await params;
  const { page: rawPage } = await searchParams;

  const pub = getPublication(publication);
  if (!pub) notFound();

  const entries = await getArchive(pub);

  const totalPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(rawPage) || 1), totalPages);
  const visible = entries.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="mx-auto max-w-shell px-5 py-8 sm:py-14">
      {/* The way back. Without it the only route home was the logo, which is
          not obviously a link on a phone. */}
      <nav className="mb-8">
        <Link href="/" className="bm-eyebrow hover:text-ink">
          ← All publications
        </Link>
      </nav>

      <h1 className="text-display-sm sm:text-display-md">{pub.name}</h1>
      <p className="mt-4 max-w-measure text-mute">{pub.blurb}</p>

      <div className="mt-10">
        <ArchiveList publication={pub} entries={visible} />
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-between gap-4 border-t border-hair pt-6"
        >
          {page > 1 ? (
            <Link
              href={`/${pub.slug}${page - 1 === 1 ? '' : `?page=${page - 1}`}`}
              className="bm-eyebrow hover:text-ink"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}

          <span className="bm-eyebrow !text-mute">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link href={`/${pub.slug}?page=${page + 1}`} className="bm-eyebrow hover:text-ink">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
