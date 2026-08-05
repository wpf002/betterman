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
 * The book: an optional numeral ("1 Samuel"), or a name joined by "of"
 * ("Song of Solomon").
 *
 * The leading `(?:[A-Z][a-zA-Z]*\s+)?` is a word we expect to THROW AWAY — the
 * "In" of "In Mark 4". It has to be matched rather than ignored: without it
 * the engine reads "Read 1 Samuel 16:11" as book "Read", chapter 1, then
 * resumes at "Samuel 16:11" — and bare "Samuel" is not a book, so a perfectly
 * ordinary citation parsed to nothing at all. Being optional, it backtracks
 * out of the way for "Psalm 90:12".
 */
const BOOK_GROUP = String.raw`(?:[A-Z][a-zA-Z]*\s+)?((?:[1-3]\s*)?[A-Z][a-zA-Z]*(?:\s+of\s+[A-Z][a-zA-Z]+)?)`;
/** ":11", optionally "–15". En and em dashes both appear as range separators. */
const VERSE_GROUP = String.raw`(?::(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?`;

/**
 * Matches "John 4:11-15", "1 Thessalonians 5:18", "Psalm 90:12", "Romans 8",
 * and the abbreviated "Matt. 5:3".
 *
 * The `d` flag is required: displayRef is sliced from the book capture's own
 * offset, which is how "In Mark 4" is stored as "Mark 4".
 */
const REF_PATTERN = new RegExp(`\\b${BOOK_GROUP}\\.?\\s+(\\d{1,3})${VERSE_GROUP}`, 'gd');

/**
 * The same reference, minus the optional period between book and chapter.
 *
 * Devotionals print their references on a labelled Scripture line, so the
 * loose pattern is safe there. An essay is running prose, where "…so I told
 * Mark. 3 weeks later" reads as Mark 3 — and Mark, John, James and Job are all
 * ordinary first names. Dropping the period costs nothing (essays spell books
 * out) and removes that whole class of misreading.
 */
const PROSE_REF_PATTERN = new RegExp(`\\b${BOOK_GROUP}\\s+(\\d{1,3})${VERSE_GROUP}`, 'gd');

/**
 * A chapter with no verse, in prose, followed by an ordinary lowercase word.
 *
 * "I met James 2 days ago" and "John 3 of the men left" are not citations;
 * "In Mark 4, Jesus lets them sail into a storm" and "the sheep John 10." are.
 * What separates them is what comes next: a real citation is followed by
 * punctuation or a new clause, never by the noun the number was counting.
 */
const COUNTED_NOUN = /^\s+[a-z]/;

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
  return collectRefs(text, PROSE_REF_PATTERN, true);
}

/** Extracts every resolvable reference from a line of text, deduped. */
export function parseScriptureRefs(text: string): ParsedScriptureRef[] {
  return collectRefs(text, REF_PATTERN, false);
}

function collectRefs(text: string, pattern: RegExp, prose: boolean): ParsedScriptureRef[] {
  if (!text) return [];
  const out: ParsedScriptureRef[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const [full, rawBook, rawChapter, rawStart, rawEnd] = match;
    if (!rawBook || !rawChapter) continue;

    // A bare chapter in prose has to prove it is a citation and not a count.
    if (prose && !rawStart && match.index !== undefined) {
      if (COUNTED_NOUN.test(text.slice(match.index + full.length))) continue;
    }

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

    // Print from where the BOOK starts, not where the match does, so the
    // discarded lead-in word never reaches the index.
    const bookAt = match.indices?.[1]?.[0];
    const displayRef =
      bookAt !== undefined && match.index !== undefined
        ? full.slice(bookAt - match.index).trim()
        : full.trim();

    out.push({ book, chapter, verseStart, verseEnd, displayRef, isPrimary: false });
  }

  return prose ? dropChaptersCoveredByAVerse(out) : out;
}

/**
 * Drops a bare chapter when the same piece already cites a verse inside it.
 *
 * An essay that quotes Mark 5:30 and also says "in Mark 5" is citing one
 * passage, not two, and listing it twice under Mark is just noise. The verse
 * is the more useful of the pair, so it is the one that stays.
 */
function dropChaptersCoveredByAVerse(refs: ParsedScriptureRef[]): ParsedScriptureRef[] {
  const withVerses = new Set(
    refs.filter((r) => r.verseStart !== null).map((r) => `${r.book}|${r.chapter}`),
  );

  return refs.filter(
    (ref) => ref.verseStart !== null || !withVerses.has(`${ref.book}|${ref.chapter}`),
  );
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
