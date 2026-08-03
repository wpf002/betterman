/**
 * BetterMornings section labels.
 *
 * The HubSpot template has changed at least twice, so the parser matches on
 * LABELS, not markup (spec §9):
 *
 *   Nov 2025 — Scripture / Thought / Reflection    / Call to Action    / Prayer
 *              plain text
 *   Jul 2026 — Scripture / Thought / Reflect       / Right Next Step   / Prayer
 *              wrapped in <strong>
 *
 * Add aliases here as new eras appear; never branch on markup shape.
 */

export const DEVOTIONAL_SECTIONS = [
  'scripture',
  'thought',
  'reflect',
  'rightNextStep',
  'fightPlan',
  'prayer',
] as const;

export type DevotionalSection = (typeof DEVOTIONAL_SECTIONS)[number];

/** Alias table, per section. Compared case- and punctuation-insensitively. */
export const SECTION_ALIASES: Record<DevotionalSection, readonly string[]> = {
  // "Read" appears in place of "Scripture" from mid-2026.
  scripture: ['scripture', 'scripture reading', 'the scripture', 'read', 'read this'],
  thought: ['thought', 'thoughts', 'the thought', "today's thought"],
  reflect: ['reflect', 'reflection', 'reflections', 'reflect on this'],
  rightNextStep: [
    'right next step',
    'call to action',
    'next step',
    'your right next step',
    'action step',
  ],
  /**
   * Autumn 2025 editions carry a "Fight Plan" — a short practice list. Its own
   * bullet labels are aliased onto the same section so they read as part of it
   * rather than as an unknown template change.
   */
  fightPlan: [
    'fight plan',
    'fight plan move',
    'weekly fight plan',
    'this weeks fight plan',
    'memorize',
    'practice',
    'limit',
    'bless',
    'confess',
  ],
  prayer: ['prayer', 'a prayer', "today's prayer"],
};

/** Which alias set a document matched — diagnostics for the review queue. */
export const TEMPLATE_ERAS = {
  '2025-11': ['scripture', 'thought', 'reflection', 'call to action', 'prayer'],
  '2026-07': ['scripture', 'thought', 'reflect', 'right next step', 'prayer'],
} as const;

/** Below this, an item is held in REVIEW instead of published (spec §9). */
export const PARSE_QUALITY_THRESHOLD = 0.9;

/** Normalizes a candidate label for alias comparison. */
export function normalizeLabel(raw: string): string {
  return raw
    // HubSpot emails are full of &nbsp; — fold them to plain spaces first.
    .replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ')
    .replace(/[:：]\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Resolves a printed label to its canonical section, or null if unknown. */
export function resolveSection(raw: string): DevotionalSection | null {
  const norm = normalizeLabel(raw);
  for (const section of DEVOTIONAL_SECTIONS) {
    if (SECTION_ALIASES[section].includes(norm)) return section;
  }
  return null;
}
