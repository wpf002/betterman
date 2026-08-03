import { describe, expect, it } from 'vitest';
import { sanitizeArticleHtml } from '../src/html/sanitize';
import {
  hashContent,
  isReadableArticle,
  normalizeSubstackPost,
} from '../src/substack/normalize';
import type { SubstackArchiveEntry } from '../src/substack/archive';

const entry = (over: Partial<SubstackArchiveEntry> = {}): SubstackArchiveEntry => ({
  id: 209066520,
  slug: 'words-from-the-mount-part-i',
  title: 'Words from the Mount Part I',
  subtitle: "I gotta' wear shades...",
  post_date: '2026-07-30T14:05:30.381Z',
  canonical_url: null,
  cover_image: null,
  audience: 'everyone',
  type: 'newsletter',
  ...over,
});

describe('readability filter', () => {
  it('keeps free posts, including podcast-type ones', () => {
    expect(isReadableArticle(entry())).toBe(true);
    expect(isReadableArticle(entry({ type: 'podcast' }))).toBe(true);
  });

  it('skips paywalled posts — the public endpoints only return a teaser', () => {
    expect(isReadableArticle(entry({ audience: 'only_paid' }))).toBe(false);
  });
});

describe('article sanitizing — strip platform chrome (spec §6/§7)', () => {
  it('removes the like / comment / share / restack row', () => {
    const html = `<div class="post-ufi"><a>Like</a><a>Comment</a><a>Restack</a></div><p>Body.</p>`;
    const clean = sanitizeArticleHtml(html);
    expect(clean).not.toContain('Restack');
    expect(clean).toContain('Body.');
  });

  it('removes subscribe widgets and "Read in app"', () => {
    const html = `
      <div class="subscription-widget-wrap"><button>Subscribe</button></div>
      <p><a href="https://substack.com/app">Read in app</a></p>
      <p>Real prose here.</p>`;
    const clean = sanitizeArticleHtml(html);
    expect(clean).not.toContain('Read in app');
    expect(clean).not.toContain('subscription-widget');
    expect(clean).toContain('Real prose here.');
  });

  it('removes the "Invite your friends" and "Forwarded this email?" footers', () => {
    const html = `<p><a>Invite your friends and earn rewards</a></p><p><a>Forwarded this email? Subscribe here</a></p><p>Keep me.</p>`;
    const clean = sanitizeArticleHtml(html);
    expect(clean).not.toContain('Invite your friends');
    expect(clean).not.toContain('Forwarded this email');
    expect(clean).toContain('Keep me.');
  });

  it('keeps italics, blockquotes and horizontal rules — the piece’s own voice', () => {
    const html = `<p>For the King,</p><p><em>— Harp</em></p><hr><blockquote><p>A quote.</p></blockquote>`;
    const clean = sanitizeArticleHtml(html);
    expect(clean).toContain('<em>');
    expect(clean).toContain('<blockquote>');
    expect(clean).toContain('<hr />');
    expect(clean).toContain('Harp');
  });

  it('drops scripts and event handlers', () => {
    const clean = sanitizeArticleHtml('<p onclick="steal()">Hi</p><script>steal()</script>');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
  });

  it('makes outbound links safe', () => {
    const clean = sanitizeArticleHtml('<p><a href="https://example.com">x</a></p>');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });
});

describe('normalization', () => {
  const post = normalizeSubstackPost(
    entry(),
    '<p>Some body copy that is long enough to be a real post.</p>',
    'charper.substack.com',
  );

  it('uses the post id as the dedupe key', () => {
    expect(post.externalId).toBe('209066520');
  });

  it('falls back to a canonical url when Substack omits one', () => {
    expect(post.canonicalUrl).toBe(
      'https://charper.substack.com/p/words-from-the-mount-part-i',
    );
  });

  it('keeps the subtitle, which the skin renders under the title', () => {
    expect(post.subtitle).toBe("I gotta' wear shades...");
  });

  it('produces a plaintext projection for search', () => {
    expect(post.contentText).toContain('Some body copy');
  });

  it('hashes the SOURCE body, so changing our sanitizer is not an author edit', () => {
    const body = '<p>Some body copy that is long enough to be a real post.</p>';
    expect(post.contentHash).toBe(hashContent(body));
  });
});
