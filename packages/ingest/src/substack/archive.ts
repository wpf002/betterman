/**
 * Substack readers. Public endpoints only — no credentials (spec §9).
 *
 * Two facts about these APIs that the code below is shaped around:
 *
 *  - `/api/v1/archive` ignores `limit` past its own page size (~19–45 posts,
 *    varying by publication), so pagination MUST advance by the number of
 *    posts actually returned, not by the requested limit.
 *  - `/api/v1/posts/by-slug/{slug}` 302s to the HTML page and never returns
 *    JSON, and archive rows come back with `body_html: null`. The full body
 *    lives in `window._preloads` on the post page, so that is what we read.
 */

const USER_AGENT = 'BettermanReader/0.1 (+https://betterman.com)';

/**
 * An optional Substack session, for publications the reader subscribes to.
 *
 * Most of Good Trouble is paid-only, and the public endpoints return a ~200
 * byte stub for those rather than the article. With a subscriber's session
 * cookie in SUBSTACK_COOKIE the same endpoints return the full body, so the
 * archive can be complete instead of 16 posts deep.
 *
 * The cookie is read from the environment and never logged. It is a bearer
 * credential for a real account: treat it like a password.
 */
export function substackCookie(): string | null {
  const raw = process.env.SUBSTACK_COOKIE?.trim();
  return raw ? raw : null;
}

export function hasSubstackSession(): boolean {
  return substackCookie() !== null;
}

/** Substack tolerates roughly 1 request/second (spec §9). */
export const RATE_LIMIT_MS = 1100;

export interface SubstackArchiveEntry {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  post_date: string;
  canonical_url: string | null;
  cover_image: string | null;
  audience: string;
  type: string;
}

export interface SubstackPost extends SubstackArchiveEntry {
  bodyHtml: string;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getText(url: string): Promise<string> {
  const cookie = substackCookie();
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/json',
      ...(cookie ? { cookie } : {}),
    },
    redirect: 'follow',
  });
  // Never echo the URL's query or the cookie into an error.
  if (!res.ok) throw new Error(`GET ${new URL(url).pathname} → ${res.status}`);
  return res.text();
}

/**
 * Walks the whole archive, oldest-safe: advances the offset by the number of
 * rows actually returned and stops on the first empty page.
 */
export async function fetchArchive(
  host: string,
  opts: { maxPages?: number; onPage?: (count: number, total: number) => void } = {},
): Promise<SubstackArchiveEntry[]> {
  const maxPages = opts.maxPages ?? 40;
  const all: SubstackArchiveEntry[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const url = `https://${host}/api/v1/archive?sort=new&offset=${offset}&limit=50`;
    const rows = JSON.parse(await getText(url)) as SubstackArchiveEntry[];
    if (!Array.isArray(rows) || rows.length === 0) break;

    all.push(...rows);
    offset += rows.length;
    opts.onPage?.(rows.length, all.length);

    await sleep(RATE_LIMIT_MS);
  }

  return all;
}

/**
 * Reads a post's full body out of the `window._preloads` blob on its page.
 * Returns null when the post is paywalled or the shape changes, so the caller
 * can skip rather than store a truncated body.
 */
export async function fetchPostBody(host: string, slug: string): Promise<string | null> {
  const html = await getText(`https://${host}/p/${slug}`);

  const match = html.match(/window\._preloads\s*=\s*JSON\.parse\("((?:[^"\\]|\\.)*)"\)/);
  if (!match?.[1]) return null;

  let preloads: unknown;
  try {
    // The blob is a JSON string literal embedded in JS: unescape, then parse.
    preloads = JSON.parse(JSON.parse(`"${match[1]}"`) as string);
  } catch {
    return null;
  }

  const post = (preloads as { post?: { body_html?: string | null } }).post;
  const body = post?.body_html;
  return typeof body === 'string' && body.length > 0 ? body : null;
}

/** RSS is only used as a cheap freshness poll; backfill goes via the archive. */
export async function fetchFeedSlugs(host: string): Promise<string[]> {
  const xml = await getText(`https://${host}/feed`);
  const slugs: string[] = [];
  for (const m of xml.matchAll(/<link>https?:\/\/[^/]+\/p\/([^<]+)<\/link>/g)) {
    if (m[1]) slugs.push(m[1]);
  }
  return slugs;
}
