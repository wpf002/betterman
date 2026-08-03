'use server';

import { revalidatePath } from 'next/cache';
import { ItemStatus, prisma } from '@betterman/db';
import { reparseItem } from '@betterman/ingest';
import { assertAdmin } from './guard';

/**
 * Manual publish / unpublish / re-run (spec §12, Phase 8).
 *
 * Every action re-checks the role rather than trusting the page that rendered
 * the button — a server action is a public endpoint, not a private one.
 */

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/admin/review');
  revalidatePath('/', 'layout');
}

/** Publishes a held piece. The reviewer has looked; their word beats the score. */
export async function publishItem(itemId: string): Promise<AdminActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: 'Not permitted.' };

  await prisma.item.update({
    where: { id: itemId },
    data: { status: ItemStatus.PUBLISHED },
  });

  refresh();
  return { ok: true, message: 'Published.' };
}

/**
 * Pulls a piece back out of the app. Notifications are not un-sent — anything
 * already delivered stays delivered — but the piece stops being readable.
 */
export async function unpublishItem(itemId: string): Promise<AdminActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: 'Not permitted.' };

  await prisma.item.update({
    where: { id: itemId },
    data: { status: ItemStatus.REVIEW },
  });

  refresh();
  return { ok: true, message: 'Pulled back for review.' };
}

/**
 * Re-runs the parser over the stored payload. This is the action to reach for
 * after fixing the parser: it applies the fix to the piece without re-fetching
 * anything, which for the devotional archive is the only option there is.
 */
export async function rerunItem(itemId: string): Promise<AdminActionResult> {
  if (!(await assertAdmin())) return { ok: false, message: 'Not permitted.' };

  const result = await reparseItem(itemId);
  refresh();

  if (!result.ok) return { ok: false, message: result.reason ?? 'Could not re-run.' };

  const quality =
    typeof result.parseQuality === 'number' ? ` (quality ${result.parseQuality.toFixed(3)})` : '';

  return {
    ok: true,
    message:
      result.status === ItemStatus.PUBLISHED
        ? `Re-parsed and published${quality}.`
        : `Re-parsed, still held${quality}.`,
  };
}
