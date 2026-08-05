import { createHash } from 'node:crypto';
import { sanitizeArticleHtml, htmlToText } from '../html/sanitize.js';
import {
  parseScriptureRefsInProse,
  type ParsedScriptureRef,
} from '../devotional/scripture.js';
import type { SubstackArchiveEntry } from './archive.js';

/** The shape both sources normalize into before hitting the database. */
export interface NormalizedItem {
  externalId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: Date;
  canonicalUrl: string | null;
  heroImageUrl: string | null;
  contentHtml: string;
  contentText: string;
  contentHash: string;
}

/** Detects upstream edits — the author changing a published piece. */
export function hashContent(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

/**
 * Whether a post's full body is publicly readable.
 *
 * `only_paid` posts return a truncated teaser from the public endpoints, and
 * spec §9 is explicit that we use public feeds with no credentials — so they
 * are skipped rather than stored half-complete. Podcast-type posts ARE kept
 * when they are free: they carry real prose, and they are part of the
 * publication the reader chose.
 */
export function isReadableArticle(
  entry: SubstackArchiveEntry,
  withSubscription = false,
): boolean {
  if (entry.audience === 'everyone') return true;
  // A subscriber's session unlocks the rest. Without one these return a stub,
  // and MIN_BODY_CHARS catches any that slip through with an expired cookie.
  return withSubscription;
}

/** Bodies shorter than this are teasers or stubs, not the piece itself. */
export const MIN_BODY_CHARS = 400;

export function normalizeSubstackPost(
  entry: SubstackArchiveEntry,
  bodyHtml: string,
  host: string,
): NormalizedItem {
  const contentHtml = sanitizeArticleHtml(bodyHtml);
  return {
    externalId: String(entry.id),
    slug: entry.slug,
    title: entry.title?.trim() || entry.slug,
    subtitle: entry.subtitle?.trim() || null,
    publishedAt: new Date(entry.post_date),
    canonicalUrl: entry.canonical_url ?? `https://${host}/p/${entry.slug}`,
    heroImageUrl: entry.cover_image ?? null,
    contentHtml,
    contentText: htmlToText(contentHtml),
    // Hash the SOURCE body, not the sanitized output: a change to our own
    // sanitizer must not read as the author having edited the post.
    contentHash: hashContent(bodyHtml),
  };
}

/**
 * The passages an essay cites, for the Scripture index.
 *
 * An essay has no Scripture section to point at, so every reference is one
 * quoted along the way — none of them lead. That is why they are all
 * secondary: a devotional built on Psalm 90:12 should still come first under
 * Psalm 90, ahead of an article that mentions it in passing.
 */
export function scriptureRefsForArticle(item: NormalizedItem): ParsedScriptureRef[] {
  return parseScriptureRefsInProse(
    [item.title, item.subtitle ?? '', item.contentText].join('\n'),
  );
}
