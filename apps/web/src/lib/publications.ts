/**
 * The three reading surfaces. There is no merged feed and no "everything"
 * route — a reader picks a publication, then reads within it (spec §2).
 */
import { SourceKey } from '@betterman/db';

export interface Publication {
  slug: 'bettermornings' | 'good-trouble' | 'josiah-jones';
  key: SourceKey;
  name: string;
  /** Shown as an eyebrow on the home chooser. */
  cadence: string;
  blurb: string;
  /** Where the author publishes, for the archive footer link. */
  homeUrl: string;
}

export const PUBLICATIONS: readonly Publication[] = [
  {
    slug: 'bettermornings',
    key: SourceKey.BETTERMORNINGS,
    name: 'BetterMornings',
    cadence: 'Weekday mornings',
    blurb: 'The daily devotional from BetterMan.',
    homeUrl: 'https://betterman.com/daily-devotional',
  },
  {
    slug: 'good-trouble',
    key: SourceKey.GOOD_TROUBLE,
    name: 'Good Trouble',
    cadence: 'About twice a week',
    // Each author's own line, not a description written for them.
    blurb: "If you're going to be trouble... be good trouble.",
    homeUrl: 'https://charper.substack.com',
  },
  {
    slug: 'josiah-jones',
    key: SourceKey.JOSIAH_JONES,
    name: 'Josiah Jones',
    cadence: 'Irregular',
    blurb:
      'Jesus Follower, Husband to Cathy Jones 🤍 Dad of three 👧🏻👧🏼👶🏻 For speaking request + consulting josiahjones.org',
    homeUrl: 'https://josiahjones1.substack.com',
  },
];

export type PublicationSlug = Publication['slug'];

export function getPublication(slug: string): Publication | undefined {
  return PUBLICATIONS.find((p) => p.slug === slug);
}
