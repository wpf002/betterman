'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@betterman/db';
import { getSessionUser } from '../auth/session';

/**
 * Reader state: bookmarks, reading progress, and saved Right Next Steps.
 *
 * All of it hangs off the user row, so it follows the reader across devices
 * (spec §12, Phase 5) rather than living in this browser.
 */

async function currentUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

export async function toggleBookmark(itemId: string, path: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const existing = await prisma.bookmark.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { id: true },
  });

  if (existing) await prisma.bookmark.delete({ where: { id: existing.id } });
  else await prisma.bookmark.create({ data: { userId, itemId } });

  revalidatePath(path);
  revalidatePath('/saved');
}

/**
 * Saves the Right Next Step the reader is committing to.
 *
 * The text is snapshotted rather than referenced, so a later upstream edit —
 * or a parser improvement — cannot rewrite a commitment someone already made.
 */
export async function saveNextStep(itemId: string, path: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const existing = await prisma.savedNextStep.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.savedNextStep.delete({ where: { id: existing.id } });
  } else {
    const devotional = await prisma.devotional.findUnique({
      where: { itemId },
      select: { rightNextStep: true },
    });
    if (!devotional?.rightNextStep) return;

    await prisma.savedNextStep.create({
      data: { userId, itemId, stepText: devotional.rightNextStep },
    });
  }

  revalidatePath(path);
  revalidatePath('/saved');
}

export async function completeNextStep(itemId: string, done: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  await prisma.savedNextStep.updateMany({
    where: { userId, itemId },
    data: { completedAt: done ? new Date() : null },
  });

  revalidatePath('/saved');
}

/**
 * Records scroll depth. Called from the client as the reader moves through a
 * piece, so it must stay cheap and must never throw into the UI.
 */
export async function recordProgress(itemId: string, percent: number): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const clamped = Math.max(0, Math.min(1, percent));
  const completedAt = clamped >= 0.9 ? new Date() : null;

  await prisma.readingProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    create: { userId, itemId, percent: clamped, completedAt },
    // Never let a jump back to the top erase how far someone actually got.
    update: {
      percent: { set: clamped },
      ...(completedAt ? { completedAt } : {}),
    },
  });
}
