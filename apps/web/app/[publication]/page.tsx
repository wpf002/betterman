import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchiveList } from '../_components/archive-list';
import { PUBLICATIONS, getPublication } from '@/lib/publications';
import { getArchive } from '@/lib/queries';

/**
 * One archive per publication. Three surfaces, never merged (spec §2).
 * Rendered in BetterMan chrome; the source skin appears only on the reading
 * page inside the 600px panel.
 */
export const revalidate = 60;

/** Only the three publications resolve — anything else 404s. */
export function generateStaticParams() {
  return PUBLICATIONS.map((pub) => ({ publication: pub.slug }));
}

export const dynamicParams = false;

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
}: {
  params: Promise<{ publication: string }>;
}) {
  const { publication } = await params;
  const pub = getPublication(publication);
  if (!pub) notFound();

  const entries = await getArchive(pub);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">{pub.cadence}</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">{pub.name}</h1>
      <p className="mt-4 max-w-measure text-mute">{pub.blurb}</p>

      <p className="bm-eyebrow mt-10 sm:mt-12">
        {entries.length} {entries.length === 1 ? 'piece' : 'pieces'}
      </p>

      <div className="mt-4">
        <ArchiveList publication={pub} entries={entries} />
      </div>
    </div>
  );
}
