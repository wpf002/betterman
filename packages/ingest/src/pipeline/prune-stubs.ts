import { SourceKind, prisma } from '@betterman/db';
import { MIN_ARTICLE_TEXT_CHARS } from '../substack/normalize.js';

/**
 * Removes posts that were stored before ingest could tell an article from an
 * announcement — Substack live-video posts whose entire body is "Thank you for
 * tuning into my live video!".
 *
 * Deleting is the right call rather than hiding them: they are not articles
 * held back for review, they are not articles at all, and an archive that
 * lists eleven identical dead ends is worse than a shorter honest one. The
 * stored raw payloads are keyed to the source rather than the item, so they
 * survive this and the posts could be rebuilt if that judgement ever changes.
 *
 * Only ever touches Substack posts. Devotionals arrive by a different path and
 * a short one is a parse failure, which belongs in review, not the bin.
 */
export interface PruneResult {
  removed: Array<{ title: string; slug: string; chars: number }>;
}

export async function pruneArticleStubs(dryRun = false): Promise<PruneResult> {
  const candidates = await prisma.item.findMany({
    where: { source: { kind: SourceKind.SUBSTACK } },
    select: { id: true, title: true, slug: true, contentText: true },
  });

  // A null body is the emptiest stub there is, so it counts as one.
  const readable = (text: string | null) => (text ?? '').trim().length;
  const stubs = candidates.filter((item) => readable(item.contentText) < MIN_ARTICLE_TEXT_CHARS);

  if (!dryRun && stubs.length) {
    // Everything hanging off an item — bookmarks, progress, scripture refs —
    // cascades, so this needs no companion cleanup.
    await prisma.item.deleteMany({ where: { id: { in: stubs.map((s) => s.id) } } });
  }

  return {
    removed: stubs.map((s) => ({
      title: s.title,
      slug: s.slug,
      chars: readable(s.contentText),
    })),
  };
}
