import { describe, expect, it } from 'vitest';
import { parseScriptureRefs, parseScriptureRefsInProse } from '../src/devotional/scripture';

/**
 * Substack essays have no Scripture section, so their references have to be
 * read out of running prose — where half the books of the Bible double as
 * ordinary first names. These guard the line between the two parsers.
 */
describe('parseScriptureRefsInProse', () => {
  it('finds real citations', () => {
    const refs = parseScriptureRefsInProse(
      'Paul writes in Romans 8:28 that God works. See also 1 Corinthians 13:4-7 and Psalm 90:12.',
    );

    expect(refs.map((r) => r.displayRef)).toEqual([
      'Romans 8:28',
      '1 Corinthians 13:4-7',
      'Psalm 90:12',
    ]);
    expect(refs.map((r) => r.book)).toEqual(['Romans', '1 Corinthians', 'Psalm']);
    // An essay has no passage it is built on, so nothing leads.
    expect(refs.every((r) => !r.isPrimary)).toBe(true);
  });

  it('reads verse ranges with an en dash', () => {
    const [ref] = parseScriptureRefsInProse('He quotes John 4:11–15 at length.');
    expect(ref).toMatchObject({ book: 'John', chapter: 4, verseStart: 11, verseEnd: 15 });
  });

  it('does not read a name followed by a count as a passage', () => {
    for (const line of [
      'So I told Mark. 3 weeks later he called.',
      'John 3 of the men left before the end.',
      'I met James 2 days ago.',
      'Job 1 was the hardest I ever had.',
      'Acts 2 as a reminder that it worked.',
    ]) {
      expect(parseScriptureRefsInProse(line), line).toEqual([]);
    }
  });

  it('still reads a bare chapter that is genuinely a citation', () => {
    // Both of these are real sentences from the library that the first cut of
    // this parser dropped. A citation is followed by punctuation or a new
    // clause; a count is followed by the noun it counts.
    expect(
      parseScriptureRefsInProse('In Mark 4, Jesus lets His disciples sail into a storm.'),
    ).toMatchObject([{ book: 'Mark', chapter: 4, verseStart: null }]);

    expect(
      parseScriptureRefsInProse('the Good Shepherd who lays down His life for the sheep John 10.'),
    ).toMatchObject([{ book: 'John', chapter: 10 }]);
  });

  it('prints the reference without the words leading into it', () => {
    // The pattern has to allow a capitalized word before the book to catch
    // "1 Samuel", which means "In Mark 4" matches with "In" attached. The
    // index should show the citation, not the sentence.
    const [ref] = parseScriptureRefsInProse('In Mark 4, Jesus lets them sail into a storm.');
    expect(ref?.displayRef).toBe('Mark 4');

    const [named] = parseScriptureRefsInProse('Read 1 Samuel 16:11 again.');
    expect(named?.displayRef).toBe('1 Samuel 16:11');
    expect(named?.book).toBe('1 Samuel');
  });

  it('does not list a chapter it has already cited a verse from', () => {
    const refs = parseScriptureRefsInProse(
      'In Mark 5, a woman touches Him. Mark 5:30 says He felt power leave.',
    );
    expect(refs.map((r) => r.displayRef)).toEqual(['Mark 5:30']);
  });

  it('rejects a period between the book and the chapter', () => {
    expect(parseScriptureRefsInProse('...I said to Mark. 3:16 was on the sign')).toEqual([]);
  });

  it('is stricter than the devotional parser, which is why it exists', () => {
    const line = 'So I told Mark. 3 weeks later.';
    expect(parseScriptureRefs(line)).toHaveLength(1);
    expect(parseScriptureRefsInProse(line)).toHaveLength(0);
  });
});
