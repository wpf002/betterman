/**
 * Scripture reference parsing, for the Phase 7 index ("every passage ever
 * taught, browsable by book and chapter").
 *
 * Kept deliberately conservative: a reference we cannot confidently resolve is
 * skipped rather than guessed at, so the index never claims a devotional
 * taught a passage it did not.
 */

/** Canonical book names, with the abbreviations that actually appear. */
const BOOKS: ReadonlyArray<readonly [canonical: string, ...aliases: string[]]> = [
  ['Genesis', 'gen', 'ge', 'gn'],
  ['Exodus', 'exod', 'ex'],
  ['Leviticus', 'lev', 'lv'],
  ['Numbers', 'num', 'nm'],
  ['Deuteronomy', 'deut', 'dt'],
  ['Joshua', 'josh', 'jos'],
  ['Judges', 'judg', 'jdg'],
  ['Ruth', 'rth'],
  ['1 Samuel', '1 sam', '1sam', 'i samuel'],
  ['2 Samuel', '2 sam', '2sam', 'ii samuel'],
  ['1 Kings', '1 kgs', '1kings'],
  ['2 Kings', '2 kgs', '2kings'],
  ['1 Chronicles', '1 chron', '1 chr'],
  ['2 Chronicles', '2 chron', '2 chr'],
  ['Ezra'],
  ['Nehemiah', 'neh'],
  ['Esther', 'esth'],
  ['Job'],
  ['Psalm', 'psalms', 'ps', 'psa'],
  ['Proverbs', 'prov', 'prv'],
  ['Ecclesiastes', 'eccl', 'ecc'],
  ['Song of Solomon', 'song of songs', 'song'],
  ['Isaiah', 'isa'],
  ['Jeremiah', 'jer'],
  ['Lamentations', 'lam'],
  ['Ezekiel', 'ezek', 'eze'],
  ['Daniel', 'dan'],
  ['Hosea', 'hos'],
  ['Joel'],
  ['Amos'],
  ['Obadiah', 'obad'],
  ['Jonah', 'jon'],
  ['Micah', 'mic'],
  ['Nahum', 'nah'],
  ['Habakkuk', 'hab'],
  ['Zephaniah', 'zeph'],
  ['Haggai', 'hag'],
  ['Zechariah', 'zech'],
  ['Malachi', 'mal'],
  ['Matthew', 'matt', 'mt'],
  ['Mark', 'mk'],
  ['Luke', 'lk'],
  ['John', 'jn'],
  ['Acts'],
  ['Romans', 'rom'],
  ['1 Corinthians', '1 cor', '1cor'],
  ['2 Corinthians', '2 cor', '2cor'],
  ['Galatians', 'gal'],
  ['Ephesians', 'eph'],
  ['Philippians', 'phil', 'php'],
  ['Colossians', 'col'],
  ['1 Thessalonians', '1 thess', '1 thes'],
  ['2 Thessalonians', '2 thess', '2 thes'],
  ['1 Timothy', '1 tim'],
  ['2 Timothy', '2 tim'],
  ['Titus'],
  ['Philemon', 'phlm'],
  ['Hebrews', 'heb'],
  ['James', 'jas'],
  ['1 Peter', '1 pet'],
  ['2 Peter', '2 pet'],
  ['1 John', '1 jn'],
  ['2 John', '2 jn'],
  ['3 John', '3 jn'],
  ['Jude'],
  ['Revelation', 'rev'],
];

/** alias (lowercased, no punctuation) → canonical book name. */
const BOOK_LOOKUP = new Map<string, string>();
for (const [canonical, ...aliases] of BOOKS) {
  BOOK_LOOKUP.set(normalizeBook(canonical), canonical);
  for (const alias of aliases) BOOK_LOOKUP.set(normalizeBook(alias), canonical);
}

function normalizeBook(raw: string): string {
  return raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

export interface ParsedScriptureRef {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  /** The reference exactly as printed. */
  displayRef: string;
  /**
   * True for the passage the devotional is built on — its Scripture section —
   * false for one quoted along the way. Both belong in the index; only the
   * first should lead it.
   */
  isPrimary: boolean;
}

/**
 * Matches "John 4:11-15", "1 Thessalonians 5:18", "Psalm 90:12", "Romans 8".
 * En-dashes and em-dashes are accepted as verse-range separators, because the
 * emails use them interchangeably with hyphens.
 */
const REF_PATTERN =
  /\b((?:[1-3]\s*)?[A-Z][a-zA-Z]*(?:\s+of\s+[A-Z][a-zA-Z]+)?(?:\s+[A-Z][a-zA-Z]+)?)\.?\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?/g;

/**
 * The same reference, but a verse is mandatory and no period may sit between
 * the book and the chapter.
 *
 * Devotionals print their references in a labelled Scripture line, so the
 * loose pattern is safe there. An essay is running prose, where the loose
 * pattern reads "…so I told Mark. 3 weeks later" as Mark 3, and half the books
 * of the Bible double as ordinary first names — Mark, John, James, Job. A
 * Scripture index that invents a passage is worse than one that misses a bare
 * chapter citation, so prose has to name a verse.
 */
const PROSE_REF_PATTERN =
  /\b((?:[1-3]\s*)?[A-Z][a-zA-Z]*(?:\s+of\s+[A-Z][a-zA-Z]+)?(?:\s+[A-Z][a-zA-Z]+)?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/g;

/**
 * Merges reference lists, keeping one row per passage and preferring the
 * primary reading when the same passage appears in both.
 */
export function mergeScriptureRefs(
  ...lists: ParsedScriptureRef[][]
): ParsedScriptureRef[] {
  const byKey = new Map<string, ParsedScriptureRef>();

  for (const list of lists) {
    for (const ref of list) {
      const key = `${ref.book}|${ref.chapter}|${ref.verseStart ?? ''}|${ref.verseEnd ?? ''}`;
      const existing = byKey.get(key);
      if (!existing) byKey.set(key, ref);
      else if (ref.isPrimary && !existing.isPrimary) byKey.set(key, ref);
    }
  }

  return [...byKey.values()];
}

/**
 * Extracts every resolvable reference from an essay, requiring a verse.
 *
 * Substack articles carry no Scripture section, so without this they put
 * nothing at all in the index no matter how much Bible they quote.
 */
export function parseScriptureRefsInProse(text: string): ParsedScriptureRef[] {
  return collectRefs(text, PROSE_REF_PATTERN);
}

/** Extracts every resolvable reference from a line of text, deduped. */
export function parseScriptureRefs(text: string): ParsedScriptureRef[] {
  return collectRefs(text, REF_PATTERN);
}

function collectRefs(text: string, pattern: RegExp): ParsedScriptureRef[] {
  if (!text) return [];
  const out: ParsedScriptureRef[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const [full, rawBook, rawChapter, rawStart, rawEnd] = match;
    if (!rawBook || !rawChapter) continue;

    // Try the longest candidate first ("Song of Solomon" before "Song").
    const candidates = [rawBook, rawBook.split(/\s+/).slice(-2).join(' '), rawBook.split(/\s+/).pop() ?? ''];
    let book: string | undefined;
    for (const candidate of candidates) {
      const hit = BOOK_LOOKUP.get(normalizeBook(candidate));
      if (hit) {
        book = hit;
        break;
      }
    }
    if (!book) continue;

    const chapter = Number(rawChapter);
    const verseStart = rawStart ? Number(rawStart) : null;
    const verseEnd = rawEnd ? Number(rawEnd) : null;

    const key = `${book}|${chapter}|${verseStart ?? ''}|${verseEnd ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ book, chapter, verseStart, verseEnd, displayRef: full.trim(), isPrimary: false });
  }

  return out;
}

/**
 * Splits a Scripture section into the quoted verse and its reference.
 * The emails print the verse in italics, then an em dash, then the reference:
 *   "So teach us to number our days…" — Psalm 90:12
 */
export function splitScriptureLine(text: string): { text: string | null; ref: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { text: null, ref: null };

  // Some editions bracket the reference instead of setting it off with a dash:
  //   “Do you see a person wise in their own eyes?…” (Proverbs 26:12)
  //   “…Where are you?’” [Genesis 3:9]
  const bracketed = trimmed.match(/^(.*?)\s*[([]([^)\]]{3,60})[)\]]\s*$/s);
  if (bracketed) {
    const [, body, ref] = bracketed;
    if (ref && parseScriptureRefs(ref).length > 0) {
      return { text: stripQuotes((body ?? '').trim()), ref: ref.trim() };
    }
  }

  // Candidate separators are spaced dashes. Verses contain dashes of their own
  // ("a new year—clean, untouched—"), and so do references ("John 4:11–15"),
  // so we try candidates from the RIGHT and accept the first whose tail
  // actually parses as a reference.
  const candidates: number[] = [];
  // The space AFTER the dash is optional ("unity!” —Psalm 133:1"); the space
  // BEFORE it is not, or every hyphenated word inside a verse would match.
  for (const m of trimmed.matchAll(/\s[—–-]\s*/g)) {
    if (m.index !== undefined) candidates.push(m.index);
  }

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const idx = candidates[i] as number;
    const ref = trimmed.slice(idx).replace(/^\s*[—–-]\s*/, '').trim();
    if (!ref || parseScriptureRefs(ref).length === 0) continue;
    return { text: stripQuotes(trimmed.slice(0, idx).trim()), ref };
  }

  // No reference printed — treat the whole thing as the verse.
  return { text: stripQuotes(trimmed), ref: null };
}

function stripQuotes(s: string): string {
  return s.replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim();
}
