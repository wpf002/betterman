import { ItemStatus, SourceKind, prisma } from '@betterman/db';
import { parseScriptureRefsInProse } from '../devotional/scripture.js';

/**
 * Rebuilds the Scripture index for articles already in the library.
 *
 * Articles were ingested before they contributed anything to the index, so the
 * index only ever showed devotionals. A normal poll cannot repair that: an
 * unchanged article short-circuits on its content hash long before the parser
 * runs, which is correct — re-running ingest should be a no-op.
 *
 * Nothing is re-fetched. The references come from the text already stored, so
 * this is safe to run repeatedly and costs the sources nothing.
 */
export interface ScriptureBackfillResult {
  scanned: number;
  changed: number;
  refsWritten: number;
}

export async function backfillArticleScriptureRefs(
  log: (message: string) => void = () => {},
): Promise<ScriptureBackfillResult> {
  const items = await prisma.item.findMany({
    where: { status: ItemStatus.PUBLISHED, source: { kind: SourceKind.SUBSTACK } },
    select: { id: true, title: true, subtitle: true, contentText: true },
  });

  const result: ScriptureBackfillResult = { scanned: 0, changed: 0, refsWritten: 0 };

  for (const item of items) {
    result.scanned += 1;

    const refs = parseScriptureRefsInProse(
      [item.title, item.subtitle ?? '', item.contentText].join('\n'),
    );

    const before = await prisma.scriptureRef.count({ where: { itemId: item.id } });
    if (before === 0 && refs.length === 0) continue;

    // Replace wholesale, exactly as ingest does, so a re-run converges rather
    // than accumulating duplicates.
    await prisma.scriptureRef.deleteMany({ where: { itemId: item.id } });
    if (refs.length) {
      await prisma.scriptureRef.createMany({
        data: refs.map((ref) => ({ ...ref, itemId: item.id })),
      });
    }

    result.changed += 1;
    result.refsWritten += refs.length;
    log(`  ${item.title} — ${refs.map((r) => r.displayRef).join(', ') || 'none'}`);
  }

  return result;
}
