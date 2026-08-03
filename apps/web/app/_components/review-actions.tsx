'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { publishItem, rerunItem, type AdminActionResult } from '@/lib/admin/actions';

const BUTTON =
  'rounded-pill border px-5 py-2.5 text-[12px] font-bold uppercase tracking-[2px] transition-colors disabled:opacity-50';

/**
 * Publish / re-run for one held piece.
 *
 * "Re-run" replays the stored payload through the current parser, which is the
 * action to reach for after fixing the parser — it never re-fetches, so it
 * works for the devotional archive whose mailbox credential is gone.
 */
export function ReviewActions({ itemId, href }: { itemId: string; href: string }) {
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<AdminActionResult>) => {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => rerunItem(itemId))}
        className={`${BUTTON} border-hair text-mute hover:border-clay hover:text-clay-deep`}
      >
        Re-run parser
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => publishItem(itemId))}
        className={`${BUTTON} border-clay bg-clay text-white hover:bg-clay-deep`}
      >
        Publish anyway
      </button>

      {/* A reviewer should be able to read the thing before deciding. */}
      <Link href={href} className="bm-eyebrow hover:text-ink">
        Preview →
      </Link>

      {result ? (
        <span
          role="status"
          className={`text-[15px] ${result.ok ? 'text-mute' : 'font-bold text-clay-deep'}`}
        >
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
