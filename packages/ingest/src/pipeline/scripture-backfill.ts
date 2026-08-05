import { ItemStatus, SourceKind, prisma } from '@betterman/db';
import {
  mergeScriptureRefs,
  parseScriptureRefs,
  parseScriptureRefsInProse,
  type ParsedScriptureRef,
} from '../devotional/scripture.js';

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
    where: { status: ItemStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      subtitle: true,
      contentText: true,
      source: { select: { kind: true } },
      // A devotional's references come from its parsed sections, not its raw
      // body, so that the passage it is BUILT on stays marked as primary.
      devotional: {
        select: {
          scriptureRef: true,
          thought: true,
          reflect: true,
          rightNextStep: true,
          fightPlan: true,
          prayer: true,
        },
      },
    },
  });

  const result: ScriptureBackfillResult = { scanned: 0, changed: 0, refsWritten: 0 };

  for (const item of items) {
    result.scanned += 1;

    const refs = item.devotional
      ? devotionalRefs(item.title, item.devotional)
      : item.source.kind === SourceKind.SUBSTACK
        ? parseScriptureRefsInProse([item.title, item.subtitle ?? '', item.contentText].join('\n'))
        : [];

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

/**
 * The same split parseDevotional makes: the Scripture line leads, passages
 * cited in the teaching follow. Kept in step with parse.ts deliberately — a
 * backfill that indexed devotionals differently from ingest would leave the
 * index depending on which one last touched a row.
 */
function devotionalRefs(
  title: string,
  d: {
    scriptureRef: string | null;
    thought: string | null;
    reflect: string | null;
    rightNextStep: string | null;
    fightPlan: string | null;
    prayer: string | null;
  },
): ParsedScriptureRef[] {
  return mergeScriptureRefs(
    parseScriptureRefs(d.scriptureRef ?? '').map((ref) => ({ ...ref, isPrimary: true })),
    parseScriptureRefs(
      [title, d.thought, d.reflect, d.rightNextStep, d.fightPlan, d.prayer]
        .filter(Boolean)
        .join('\n'),
    ),
  );
}
