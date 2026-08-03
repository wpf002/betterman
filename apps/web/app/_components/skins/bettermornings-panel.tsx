import type { ReadingItem } from '@/lib/queries';

/**
 * Skin A — BetterMornings.
 *
 * The panel renders the SANITIZED ORIGINAL email (spec §9), not a
 * reconstruction from the structured fields. That is what makes it
 * indistinguishable from the inbox: the HubSpot markup, the logo, the hero
 * banner, the labels and all three CTAs arrive exactly as BetterMan sent them.
 * The structured fields exist for the Scripture index and saved Right Next
 * Steps, not for rendering.
 *
 * Sanitizing already happened on ingest — tracking pixel, unsubscribe,
 * manage-preferences and the social row are gone, the three CTAs are kept
 * (spec §5). Nothing is sanitized here (spec §13).
 *
 * One consequence worth knowing: CTA order follows the edition. The current
 * template sends Give / Get Connected / Subscribe, matching §5; editions from
 * late 2025 sent them reversed. Reordering would mean editing the original, so
 * the panel shows what actually arrived.
 */
export function BettermorningsPanel({ item }: { item: ReadingItem }) {
  return (
    <article
      className="skin-bettermornings bm-panel-frame"
      // Sanitized at ingest; see the module comment.
      dangerouslySetInnerHTML={{ __html: item.contentHtml }}
    />
  );
}
