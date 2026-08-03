/**
 * BetterMornings devotional normalizer.
 *
 * The HubSpot template has changed at least twice and will change again, so
 * NOTHING here branches on markup shape (spec §9). The algorithm is:
 *
 *   1. Find the date heading and the title.
 *   2. Walk the content paragraphs in order.
 *   3. When a paragraph opens with a known section label, start that section;
 *      otherwise append the paragraph to whichever section is currently open.
 *
 * That absorbs the differences we have actually seen between the 2025-11 and
 * 2026-07 templates — <strong>-wrapped vs plain labels, an extra nesting div,
 * a bold vs plain title, different paragraph styles — without any of them
 * being encoded here.
 */
import * as cheerio from 'cheerio';
import {
  DEVOTIONAL_SECTIONS,
  PARSE_QUALITY_THRESHOLD,
  resolveSection,
  type DevotionalSection,
} from './sections.js';
import { parseScriptureRefs, splitScriptureLine, type ParsedScriptureRef } from './scripture.js';

export interface ParsedDevotional {
  /** Calendar date the devotional is for, as printed in the email. */
  date: Date | null;
  /** ISO yyyy-mm-dd, the route segment and the natural key. */
  dateKey: string | null;
  title: string | null;

  scriptureText: string | null;
  scriptureRef: string | null;
  thought: string | null;
  reflect: string | null;
  rightNextStep: string | null;
  /** "Fight Plan" — a practice list carried by the autumn 2025 editions. */
  fightPlan: string | null;
  prayer: string | null;

  /** 0–1. Below PARSE_QUALITY_THRESHOLD the item is held for review. */
  parseQuality: number;
  /** Which alias set matched, e.g. "2025-11" | "2026-07" | "mixed". */
  templateEra: string | null;
  /** Labels seen that resolved to no known section — surfaced in review. */
  unmatched: string[];
  /** Every scripture reference found anywhere in the devotional. */
  scriptureRefs: ParsedScriptureRef[];
}

/** Labels whose wording identifies the template era. */
const ERA_MARKERS: Record<string, readonly string[]> = {
  '2025-11': ['reflection', 'call to action'],
  '2026-07': ['reflect', 'right next step'],
};

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** "July 28, 2026" → Date (UTC midnight; the devotional is a calendar day). */
export function parseDevotionalDate(raw: string): Date | null {
  const m = raw
    .replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ')
    .trim()
    .match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const [, monthName, day, year] = m;
  const month = MONTHS.indexOf((monthName ?? '').toLowerCase());
  if (month === -1) return null;
  return new Date(Date.UTC(Number(year), month, Number(day)));
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Paragraph {
  text: string;
  /** Whether this paragraph opens with an emphasized "Label:" run. */
  labelIsBold: boolean;
}

/** Normalizes the text of one paragraph: nbsp folded, whitespace collapsed. */
function paragraphText($el: { text(): string }): string {
  return $el
    .text()
    .replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits "Scripture: the verse…" into its label and remainder. Accepts the
 * label with or without a colon, and tolerates the trailing space HubSpot
 * leaves inside <strong> ("Prayer: ").
 */
function splitLabel(text: string): { label: string; rest: string } | null {
  const m = text.match(/^([A-Za-z][A-Za-z' ]{1,28}?)\s*:\s*(.*)$/s);
  if (!m) return null;
  const [, label, rest] = m;
  return { label: label ?? '', rest: (rest ?? '').trim() };
}

/**
 * Parses a BetterMornings email body (raw or sanitized HTML) into fields.
 */
export function parseDevotional(html: string): ParsedDevotional {
  const $ = cheerio.load(html);

  // --- Date -------------------------------------------------------------
  // The date is the h2 in the rich-text block. Fall back to the first thing
  // in the body that parses as a date, so a heading-level change is survivable.
  let date: Date | null = null;
  $('h1, h2, h3').each((_, el) => {
    if (date) return;
    date = parseDevotionalDate($(el).text());
  });

  // --- Content paragraphs ----------------------------------------------
  // Everything inside the rich-text widget, in document order. The selector
  // falls back to the whole body so a widget-class change is survivable too.
  const $scope = $('[data-hs-cos-type="rich_text"]').length
    ? $('[data-hs-cos-type="rich_text"]')
    : $('body');

  const paragraphs: Paragraph[] = [];
  $scope.find('p, li').each((_, el) => {
    const $el = $(el);
    const text = paragraphText($el);
    if (!text) return;

    // A real section label is emphasized in every template era we have seen.
    // KNOWN labels are still matched on text alone, in any markup — this flag
    // only decides whether an UNKNOWN "Word:" opener is a template change or
    // ordinary prose ("Richard Sibbes observed: …", "Rahab: …").
    const lead = $el.children('strong, b').first().text().trim();
    const labelIsBold = lead.length > 0 && text.startsWith(lead);

    paragraphs.push({ text, labelIsBold });
  });

  // --- Title ------------------------------------------------------------
  // The first content paragraph before any labelled section starts. Some
  // editions open straight into Scripture; those fall back to the preheader,
  // which carries the same headline the subject line shows.
  let title: string | null = null;
  const first = paragraphs[0];
  if (first) {
    const split = splitLabel(first.text);
    if (!split || !resolveSection(split.label)) title = first.text;
  }
  if (!title) {
    const preheader = $('#preview_text')
      .text()
      // Preheaders are padded with invisible filler (zero-width spaces, soft
      // hyphens, combining joiners) to control the inbox preview length.
      .replace(
        /[\u00A0\u00AD\u061C\u180E\u200B-\u200F\u202F\u205F\u2060-\u2064\u206A-\u206F\uFEFF]/g,
        ' ',
      )
      // Combining marks must be folded outside a character class.
      .replace(/\u034F/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (preheader) title = preheader;
  }

  // --- Sections ---------------------------------------------------------
  const sections: Partial<Record<DevotionalSection, string[]>> = {};
  const unmatched: string[] = [];
  const matchedLabels: string[] = [];
  let current: DevotionalSection | null = null;

  for (const p of paragraphs) {
    const split = splitLabel(p.text);
    if (split) {
      const section = resolveSection(split.label);
      if (section) {
        current = section;
        matchedLabels.push(split.label.trim().toLowerCase());
        // A section can be opened more than once (the Fight Plan's own bullet
        // labels all map onto it), so append rather than replace.
        const existing = sections[section] ?? [];
        sections[section] = split.rest ? [...existing, split.rest] : existing;
        continue;
      }
      // A label-shaped opener we do not know. Two things disqualify it:
      // it is not emphasized (ordinary prose — "Richard Sibbes observed: …"),
      // or no section has opened yet, which means we are still on the title
      // line, and titles carry colons of their own ("Rahab: Grace for
      // Outsiders").
      if (
        current !== null &&
        p.labelIsBold &&
        split.label.length <= 24 &&
        !unmatched.includes(split.label.trim())
      ) {
        unmatched.push(split.label.trim());
      }
    }
    if (current) sections[current]?.push(p.text);
  }

  const join = (section: DevotionalSection): string | null => {
    const parts = sections[section]?.filter(Boolean) ?? [];
    return parts.length ? parts.join('\n\n') : null;
  };

  // --- Scripture --------------------------------------------------------
  const scriptureRaw = join('scripture');
  const { text: scriptureText, ref: scriptureRef } = scriptureRaw
    ? splitScriptureLine(scriptureRaw)
    : { text: null, ref: null };

  // --- Era --------------------------------------------------------------
  let templateEra: string | null = null;
  const eraHits = Object.entries(ERA_MARKERS).filter(([, markers]) =>
    markers.some((m) => matchedLabels.includes(m)),
  );
  if (eraHits.length === 1) templateEra = eraHits[0]?.[0] ?? null;
  else if (eraHits.length > 1) templateEra = 'mixed';

  const parsed: Omit<ParsedDevotional, 'parseQuality'> = {
    date,
    dateKey: date ? toDateKey(date) : null,
    title,
    scriptureText,
    scriptureRef,
    thought: join('thought'),
    reflect: join('reflect'),
    rightNextStep: join('rightNextStep'),
    fightPlan: join('fightPlan'),
    prayer: join('prayer'),
    templateEra,
    unmatched,
    scriptureRefs: parseScriptureRefs(scriptureRef ?? scriptureRaw ?? ''),
  };

  return { ...parsed, parseQuality: scoreParseQuality(parsed) };
}

/**
 * Quality score, 0–1. Weighted so that a devotional missing its date, title or
 * Scripture can never clear the 0.9 publish threshold, while a missing
 * optional section only nudges it down.
 */
export function scoreParseQuality(d: Omit<ParsedDevotional, 'parseQuality'>): number {
  const checks: Array<[weight: number, ok: boolean]> = [
    [0.2, d.date !== null],
    [0.15, Boolean(d.title && d.title.length > 1)],
    [0.2, Boolean(d.scriptureText && d.scriptureText.length > 10)],
    [0.1, Boolean(d.scriptureRef)],
    [0.15, Boolean(d.thought && d.thought.length > 40)],
    [0.07, Boolean(d.reflect)],
    [0.07, Boolean(d.rightNextStep)],
    [0.06, Boolean(d.prayer)],
  ];

  let score = checks.reduce((sum, [weight, ok]) => sum + (ok ? weight : 0), 0);

  // An unrecognized label means the template moved under us — the fields we
  // did fill may be wrong, so force a human look. One flat penalty: a new
  // section with six bullet labels is still one template change, and scaling
  // per label just buries the score without adding information.
  if (d.unmatched.length > 0) score -= 0.15;
  if (d.templateEra === null) score -= 0.05;

  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function shouldPublish(parseQuality: number): boolean {
  return parseQuality >= PARSE_QUALITY_THRESHOLD;
}

export { DEVOTIONAL_SECTIONS, PARSE_QUALITY_THRESHOLD };
