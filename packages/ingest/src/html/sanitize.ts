/**
 * HTML sanitizing. Runs on INGEST, never on render (spec §13).
 *
 * Two profiles, because the two kinds of source need different things kept:
 *   - `sanitizeDevotionalHtml` keeps the HubSpot email's table layout and the
 *     three BetterMan CTAs, and strips tracking, unsubscribe and social chrome.
 *   - `sanitizeArticleHtml` keeps Substack prose and strips the platform's
 *     like / comment / share / subscribe furniture.
 */
import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

/** Link hosts that only exist to count opens and clicks. */
const TRACKING_HOST = /hubspotlinks\.com|hubspotemail\.net\/Cto\//i;

/** The three CTAs are real BetterMan actions and must survive (spec §5). */
const KEEP_CTA_LABELS = [
  'give to betterman',
  'get connected',
  'subscribe to bettermornings',
];

const DEVOTIONAL_ALLOWED_TAGS = [
  'div', 'p', 'span', 'strong', 'b', 'em', 'i', 'u', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
];

const ARTICLE_ALLOWED_TAGS = [
  'div', 'p', 'span', 'strong', 'b', 'em', 'i', 'u', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption', 'pre', 'code',
];

const COMMON_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  '*': ['style'],
};

/** Inline styles worth preserving; everything else is dropped. */
const ALLOWED_STYLES = {
  '*': {
    'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(/],
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(/],
    'text-align': [/^(left|right|center|justify)$/],
    'font-style': [/^(normal|italic)$/],
    'font-weight': [/^(normal|bold|[1-9]00)$/],
    'border-radius': [/^\d+(px|%)$/],
    'line-height': [/^[\d.]+(%|px|em|rem)?$/, /^normal$/],
  },
};

const BASE_OPTIONS: sanitizeHtml.IOptions = {
  allowedAttributes: COMMON_ATTRS,
  allowedStyles: ALLOWED_STYLES,
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Anything that leaves the app opens in a new tab, safely.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

/**
 * Strips the HubSpot email furniture the reader should never see, then
 * sanitizes. Keeps the three BetterMan CTAs.
 */
export function sanitizeDevotionalHtml(rawHtml: string): string {
  const $ = cheerio.load(rawHtml, null, false);

  // 1x1 open-tracking pixels, and any zero-size image.
  $('img').each((_, el) => {
    const $img = $(el);
    const w = Number($img.attr('width'));
    const h = Number($img.attr('height'));
    const src = $img.attr('src') ?? '';
    if ((w === 1 && h === 1) || TRACKING_HOST.test(src)) $img.remove();
  });

  // Preheader text — invisible in the inbox, noise in the app.
  $('#preview_text').remove();

  // Unsubscribe / manage-preferences.
  $('a[data-unsubscribe], a[href*="preferences-center"]').each((_, el) => {
    const $a = $(el);
    // Drop the whole paragraph so no orphaned separator is left behind.
    const $p = $a.closest('p');
    if ($p.length) $p.remove();
    else $a.remove();
  });

  // Social icon row.
  $('.hs_cos_wrapper_type_social_module, table.hs_cos_wrapper_type_social_module').remove();
  $('td.social-network-cell').remove();

  // Rewrite CTA click-tracking links to nothing rather than dropping the
  // button: the label is the point, and the destination is re-resolved by the
  // renderer from BetterMan's own URLs.
  $('a').each((_, el) => {
    const $a = $(el);
    const label = $a.text().trim().toLowerCase();
    const href = $a.attr('href') ?? '';
    if (TRACKING_HOST.test(href) && !KEEP_CTA_LABELS.includes(label)) {
      $a.replaceWith($a.contents());
    }
  });

  return sanitizeHtml($.html(), {
    ...BASE_OPTIONS,
    allowedTags: DEVOTIONAL_ALLOWED_TAGS,
    allowedAttributes: {
      ...COMMON_ATTRS,
      td: ['align', 'valign', 'bgcolor', 'colspan', 'rowspan', 'style'],
      table: ['width', 'align', 'role', 'style'],
      div: ['style', 'class', 'id'],
    },
  }).trim();
}

/**
 * Strips Substack platform chrome (spec §6/§7) and sanitizes. The single
 * "Open on Substack" link is added by the renderer, not kept from the source.
 */
export function sanitizeArticleHtml(rawHtml: string): string {
  const $ = cheerio.load(rawHtml, null, false);

  const CHROME_SELECTORS = [
    '.subscription-widget-wrap',
    '.subscription-widget',
    '.subscribe-widget',
    '.button-wrapper',
    '.post-ufi',
    '.like-button-container',
    '.post-footer',
    '.footer',
    '.share-dialog',
    '.paywall',
    '.digest-post-embed',
    '[data-component-name="SubscribeWidget"]',
    '[data-component-name="ButtonCreateButton"]',
  ];
  $(CHROME_SELECTORS.join(', ')).remove();

  // "Read in app", "Share", "Subscribed", "Invite your friends…" style links.
  const CHROME_TEXT =
    /^(read in app|share|share this post|subscribe|subscribed|leave a comment|comment|restack|invite your friends.*|forwarded this email.*|subscribe here)$/i;
  $('a, button').each((_, el) => {
    const $el = $(el);
    if (CHROME_TEXT.test($el.text().trim())) {
      const $wrap = $el.closest('p, div');
      if ($wrap.length && $wrap.text().trim() === $el.text().trim()) $wrap.remove();
      else $el.remove();
    }
  });

  return sanitizeHtml($.html(), {
    ...BASE_OPTIONS,
    allowedTags: ARTICLE_ALLOWED_TAGS,
  }).trim();
}

/** Plaintext projection, for search (Phase 7) and push previews. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html, null, false);
  $('br').replaceWith('\n');
  $('p, div, h1, h2, h3, h4, li, blockquote').each((_, el) => {
    $(el).append('\n');
  });
  return $.text()
    .replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
