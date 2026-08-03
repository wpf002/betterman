import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDevotional, scoreParseQuality, shouldPublish } from '../src/devotional/parse';
import { resolveSection } from '../src/devotional/sections';
import { parseScriptureRefs, splitScriptureLine } from '../src/devotional/scripture';
import { sanitizeDevotionalHtml, htmlToText } from '../src/html/sanitize';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'devotional', name), 'utf8');

const ERA_2025 = fixture('2025-12-29.html');
const ERA_2026 = fixture('2026-07-28.html');

describe('section alias table', () => {
  it('maps both eras of the changing labels onto one canonical section', () => {
    expect(resolveSection('Reflection')).toBe('reflect');
    expect(resolveSection('Reflect')).toBe('reflect');
    expect(resolveSection('Call to Action')).toBe('rightNextStep');
    expect(resolveSection('Right Next Step')).toBe('rightNextStep');
  });

  it('tolerates the trailing space HubSpot leaves inside <strong>', () => {
    expect(resolveSection('Prayer: ')).toBe('prayer');
    expect(resolveSection('Reflection ')).toBe('reflect');
  });

  it('returns null for a label it does not know', () => {
    expect(resolveSection('Sponsored By')).toBeNull();
  });
});

describe('scripture parsing', () => {
  it('splits the verse from its reference on the final dash', () => {
    const { text, ref } = splitScriptureLine(
      '“So teach us to number our days that we may get a heart of wisdom.” — Psalm 90:12',
    );
    expect(text).toBe('So teach us to number our days that we may get a heart of wisdom.');
    expect(ref).toBe('Psalm 90:12');
  });

  it('does not mistake an em dash inside the verse for the reference split', () => {
    const { ref } = splitScriptureLine(
      '“A new year—clean, untouched—will not save us.” — Psalm 90:12',
    );
    expect(ref).toBe('Psalm 90:12');
  });

  it('parses a verse range written with an en dash', () => {
    const refs = parseScriptureRefs('John 4:11–15');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ book: 'John', chapter: 4, verseStart: 11, verseEnd: 15 });
  });

  it('parses numbered books', () => {
    expect(parseScriptureRefs('1 Thessalonians 5:18')[0]).toMatchObject({
      book: '1 Thessalonians',
      chapter: 5,
      verseStart: 18,
    });
  });

  it('skips text that only looks like a reference', () => {
    expect(parseScriptureRefs('Suite 500, Irving')).toHaveLength(0);
  });
});

describe('devotional parsing — 2025-11 era ("Reflection" / "Call to Action")', () => {
  const parsed = parseDevotional(ERA_2025);

  it('reads the date from the heading', () => {
    expect(parsed.dateKey).toBe('2025-12-29');
  });

  it('reads the title, which is NOT bold in this era', () => {
    expect(parsed.title).toBe('Numbering Our Days');
  });

  it('splits scripture into verse and reference', () => {
    expect(parsed.scriptureText).toBe(
      'So teach us to number our days that we may get a heart of wisdom.',
    );
    expect(parsed.scriptureRef).toBe('Psalm 90:12');
  });

  it('collects every paragraph of a multi-paragraph Thought', () => {
    expect(parsed.thought).toContain('A new year has a way of creating illusions');
    expect(parsed.thought).toContain('To number our days is not morbid');
    expect(parsed.thought).toContain('The new year invites us to wake up');
  });

  it('maps "Reflection" and "Call to Action" onto the canonical fields', () => {
    expect(parsed.reflect).toBe('What did last year reveal about how you spend your days?');
    expect(parsed.rightNextStep).toContain('Write down three ways you want to spend your time');
  });

  it('reads the prayer', () => {
    expect(parsed.prayer).toContain('Lord, teach me to live awake');
  });

  it('identifies the era and clears the publish threshold', () => {
    expect(parsed.templateEra).toBe('2025-11');
    expect(parsed.unmatched).toEqual([]);
    expect(parsed.parseQuality).toBeGreaterThan(0.9);
    expect(shouldPublish(parsed.parseQuality)).toBe(true);
  });
});

describe('devotional parsing — 2026-07 era ("Reflect" / "Right Next Step")', () => {
  const parsed = parseDevotional(ERA_2026);

  it('reads the date from the heading', () => {
    expect(parsed.dateKey).toBe('2026-07-28');
  });

  it('reads the title, which IS bold and one div deeper in this era', () => {
    expect(parsed.title).toBe('Thirsty?');
  });

  it('keeps a long multi-sentence scripture quote intact', () => {
    expect(parsed.scriptureText).toContain('the well is deep');
    expect(parsed.scriptureText).toContain('welling up to eternal life');
    expect(parsed.scriptureRef).toBe('John 4:11–15');
  });

  it('indexes the passage for the scripture index', () => {
    expect(parsed.scriptureRefs[0]).toMatchObject({ book: 'John', chapter: 4 });
  });

  it('maps "Reflect" and "Right Next Step" onto the same canonical fields', () => {
    expect(parsed.reflect).toContain('What earthly well do you return to');
    expect(parsed.rightNextStep).toContain('Name one');
  });

  it('does not leak the Reflect section into Thought', () => {
    expect(parsed.thought).not.toContain('What earthly well do you return to');
    expect(parsed.thought).toContain('The Samaritan woman was still thinking about the well');
  });

  it('identifies the era and clears the publish threshold', () => {
    expect(parsed.templateEra).toBe('2026-07');
    expect(parsed.unmatched).toEqual([]);
    expect(parsed.parseQuality).toBeGreaterThan(0.9);
  });
});

/**
 * These cases all come from real editions found during the mailbox backfill —
 * each one was holding a devotional in the review queue.
 */
describe('template variants found in the live archive', () => {
  const wrap = (body: string) =>
    `<body><div data-hs-cos-type="rich_text"><h2>September 16, 2025</h2>${body}</div></body>`;

  it('reads a scripture reference printed in parentheses', () => {
    const parsed = parseDevotional(
      wrap(
        `<p>Wise In Your Own Eyes</p>
         <p><strong>Scripture:</strong> “Do you see a person wise in their own eyes? There is more hope for a fool than for them.” (Proverbs 26:12)</p>
         <p><strong>Thought:</strong> ${'Pride is the quiet sin. '.repeat(4)}</p>`,
      ),
    );
    expect(parsed.scriptureRef).toBe('Proverbs 26:12');
    expect(parsed.scriptureText).toContain('wise in their own eyes');
    expect(parsed.scriptureRefs[0]).toMatchObject({ book: 'Proverbs', chapter: 26 });
  });

  it('reads a scripture reference in square brackets', () => {
    const parsed = parseDevotional(
      wrap(
        `<p>The Father’s Blessing</p>
         <p><strong>Scripture:</strong> “This is my beloved Son, with whom I am well pleased.” [Matthew 3:17]</p>`,
      ),
    );
    expect(parsed.scriptureRef).toBe('Matthew 3:17');
  });

  it('reads a reference set off by a dash with no trailing space', () => {
    const parsed = parseDevotional(
      wrap(
        `<p>Brotherhood</p>
         <p><strong>Scripture:</strong> “Behold, how good and pleasant it is when brothers dwell in unity!” —Psalm 133:1</p>`,
      ),
    );
    expect(parsed.scriptureRef).toBe('Psalm 133:1');
    expect(parsed.scriptureText).toContain('brothers dwell in unity');
  });

  it('does not treat a colon in the title as a section label', () => {
    const parsed = parseDevotional(
      wrap(
        `<p><strong>Rahab: Grace for Outsiders</strong></p>
         <p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p>`,
      ),
    );
    expect(parsed.unmatched).toEqual([]);
    expect(parsed.title).toBe('Rahab: Grace for Outsiders');
  });

  it('accepts "Read:" as the scripture label', () => {
    const parsed = parseDevotional(
      wrap(
        `<p><strong>The Word Became Flesh</strong></p>
         <p><strong>Read:</strong> “And the Word became flesh and dwelt among us.” — John 1:14</p>`,
      ),
    );
    expect(parsed.scriptureRef).toBe('John 1:14');
    expect(parsed.unmatched).toEqual([]);
  });

  it('collects a Fight Plan and its bullet labels into one section', () => {
    const parsed = parseDevotional(
      wrap(
        `<p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p>
         <p><strong>Weekly Fight Plan:</strong></p>
         <p><strong>Memorize:</strong> Joshua 1:9</p>
         <p><strong>Practice:</strong> Ten minutes of silence.</p>
         <p><strong>Confess:</strong> Name it to one man.</p>`,
      ),
    );
    expect(parsed.fightPlan).toContain('Joshua 1:9');
    expect(parsed.fightPlan).toContain('Ten minutes of silence.');
    expect(parsed.fightPlan).toContain('Name it to one man.');
    // A known section, so nothing is flagged as a template change.
    expect(parsed.unmatched).toEqual([]);
  });

  it('does not mistake prose for a section label', () => {
    const parsed = parseDevotional(
      wrap(
        `<p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p>
         <p><strong>Thought:</strong> Consider the following.</p>
         <p>Richard Sibbes observed: the heart is never idle.</p>
         <p>Rahab: a woman the genealogy refused to hide.</p>`,
      ),
    );
    expect(parsed.unmatched).toEqual([]);
    // Unemphasized prose stays in the section it appeared under.
    expect(parsed.thought).toContain('Richard Sibbes observed');
  });

  it('still flags an emphasized label it does not know', () => {
    const parsed = parseDevotional(
      wrap(
        `<p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p>
         <p><strong>Sponsored By:</strong> Someone new.</p>`,
      ),
    );
    expect(parsed.unmatched).toContain('Sponsored By');
  });

  it('falls back to the preheader when an edition has no title line', () => {
    const parsed = parseDevotional(
      `<body><div id="preview_text">Wise In Your Own Eyes&nbsp; ͏ ͏ ͏</div>
       <div data-hs-cos-type="rich_text"><h2>September 16, 2025</h2>
       <p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p></div></body>`,
    );
    expect(parsed.title).toBe('Wise In Your Own Eyes');
  });

  it('penalizes a template change once, not once per stray label', () => {
    const many = parseDevotional(
      wrap(
        `<p><strong>Scripture:</strong> “Be strong.” — Joshua 1:9</p>
         <p><strong>Alpha:</strong> a</p><p><strong>Beta:</strong> b</p><p><strong>Gamma:</strong> c</p>`,
      ),
    );
    expect(many.unmatched).toHaveLength(3);
    // Three stray labels are still one template change, not a -0.45 cliff.
    expect(many.parseQuality).toBeGreaterThan(0);
  });
});

describe('parse quality gating', () => {
  it('holds a devotional whose template moved under us', () => {
    const broken = ERA_2026.replace('<strong>Reflect:</strong>', '<strong>Ponder This:</strong>');
    const parsed = parseDevotional(broken);
    expect(parsed.unmatched).toContain('Ponder This');
    expect(shouldPublish(parsed.parseQuality)).toBe(false);
  });

  it('holds a devotional with no date', () => {
    const parsed = parseDevotional(ERA_2026.replace('July 28, 2026', ''));
    expect(parsed.date).toBeNull();
    expect(shouldPublish(parsed.parseQuality)).toBe(false);
  });

  it('scores an empty document at zero', () => {
    expect(
      scoreParseQuality({
        date: null, dateKey: null, title: null,
        scriptureText: null, scriptureRef: null, thought: null,
        reflect: null, rightNextStep: null, fightPlan: null, prayer: null,
        templateEra: null, unmatched: [], scriptureRefs: [],
      }),
    ).toBe(0);
  });
});

describe('devotional sanitizing', () => {
  const clean = sanitizeDevotionalHtml(ERA_2026);

  it('strips the tracking pixel', () => {
    expect(clean).not.toContain('TRACKING-PIXEL');
  });

  it('strips unsubscribe and manage-preferences', () => {
    expect(clean.toLowerCase()).not.toContain('unsubscribe');
    expect(clean.toLowerCase()).not.toContain('manage preferences');
  });

  it('strips the social icon row', () => {
    expect(clean).not.toContain('facebook_circle_grey');
    expect(clean).not.toContain('youtube_circle_grey');
  });

  it('strips the invisible preheader', () => {
    expect(clean).not.toContain('preview_text');
  });

  it('keeps all three BetterMan CTAs — they are real actions', () => {
    expect(clean).toContain('GIVE TO BETTERMAN');
    expect(clean).toContain('GET CONNECTED');
    expect(clean).toContain('SUBSCRIBE TO BETTERMORNINGS');
  });

  it('keeps the logo and the hero banner', () => {
    expect(clean).toContain('Betterman_logo.png');
    expect(clean).toContain('Hero_Q3.png');
  });

  it('drops script and style entirely', () => {
    const withScript = ERA_2026.replace('<body', '<script>alert(1)</script><body');
    expect(sanitizeDevotionalHtml(withScript)).not.toContain('alert(1)');
  });

  it('still parses to the same fields after sanitizing', () => {
    const fromClean = parseDevotional(clean);
    expect(fromClean.dateKey).toBe('2026-07-28');
    expect(fromClean.title).toBe('Thirsty?');
    expect(fromClean.reflect).toContain('What earthly well');
  });

  it('produces a plaintext projection for search', () => {
    const text = htmlToText(clean);
    expect(text).toContain('The Samaritan woman');
    expect(text).not.toContain('<p');
  });
});
