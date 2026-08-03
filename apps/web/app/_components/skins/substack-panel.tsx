import type { ReadingItem } from '@/lib/queries';
import type { Publication } from '@/lib/publications';
import { formatShortDate, toISODate } from '@/lib/dates';

/**
 * Skins B and C — Good Trouble and Josiah Jones.
 *
 * Substack's `body_html` is the prose only; the masthead (title, subtitle,
 * date, rule) is not part of it, so it is composed here in the order the
 * emails use (spec §6). Platform chrome — like/comment/share/restack, "Read in
 * app", the mid-post Share button, "Subscribed", "Invite your friends",
 * "Forwarded this email?" and the footer — was stripped on ingest.
 *
 * The two skins differ only in accent colour and body face (Josiah's body is
 * Spectral, a serif); both live in their own `.skin-*` class, so neither can
 * reach the chrome.
 */
export function SubstackPanel({
  item,
  publication,
  skinClass,
}: {
  item: ReadingItem;
  publication: Publication;
  skinClass: string;
}) {
  const outHref = item.canonicalUrl ?? publication.homeUrl;

  return (
    <article className={`${skinClass} bm-panel-frame`}>
      <header>
        <h1 className="substack-title">{item.title}</h1>
        {item.subtitle ? <p className="substack-subtitle">{item.subtitle}</p> : null}
        <time className="substack-date" dateTime={toISODate(item.publishedAt)}>
          {formatShortDate(item.publishedAt)}
        </time>
        <hr className="substack-rule" />
      </header>

      {/* Sanitized on ingest, never on render (spec §13). */}
      <div className="substack-body" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />

      {/* The one platform link kept, per spec §6. */}
      <p>
        <a className="substack-outlink" href={outHref} target="_blank" rel="noopener noreferrer">
          Open on Substack →
        </a>
      </p>
    </article>
  );
}
