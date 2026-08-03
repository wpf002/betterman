# BetterMan Reader

Three publications, one place to read them — with a notification when a new
piece lands in any of them.

| Surface | Source | Cadence |
| --- | --- | --- |
| **BetterMornings** | Daily devotional email from `info@betterman.com` (HubSpot) | Weekday mornings |
| **Good Trouble** | Chris Harper's Substack — `charper.substack.com` | ~2×/week |
| **Josiah Jones** | Josiah Jones' Substack — `josiahjones1.substack.com` | Irregular |

A Next.js PWA — installable, offline-capable, push-enabled. Not native.

## The core visual rule

Chrome is BetterMan. The article panel is its source email.

Every reading page is a centered **600px panel** floating on BetterMan's bone
background, with BetterMan's header above it. Inside that panel, the piece
renders exactly as it does in the inbox. A skin never leaks into the chrome, and
the chrome never leaks into a panel.

There is **no merged feed**. Home is a chooser; there are exactly three reading
surfaces.

## Layout

```
apps/web         Next.js reader (PWA)
apps/api         Fastify — ingest, feeds, push
packages/db      Prisma schema + client
packages/ingest  RSS + email parsers, devotional normalizer
packages/ui      Design system: BetterMan chrome + three source skins
packages/config  eslint, tsconfig, tailwind preset
```

## Getting started

Requires Node 20.11+, pnpm 9, and Docker (for Postgres 16 and Redis).

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Postgres binds to **5440** and Redis to **6381**, not their defaults — 5432 and
6379 are usually already taken on a dev machine. `.env.example` and
`docker-compose.yml` agree; change both together.

The reader runs on `http://localhost:3000`, the API on `http://localhost:4000`.
`GET /health` returns 200 once the process is up and the database answers.

## Design tokens

All brand values are **sampled**, never invented — from betterman.com's rendered
CSS, the HubSpot email source, or the Substack theme configs. They live in two
disjoint namespaces in `packages/ui/src/tokens.css`:

- `:root` — BetterMan chrome. One accent, `--clay` `#C28154`.
- `.skin-bettermornings` / `.skin-good-trouble` / `.skin-josiah-jones` — one
  source panel each. Skin variables are declared only inside their panel class.

Type is Adobe Fonts kit **`sbo2xxd`**, linked publicly from betterman.com. It
serves `neue-haas-grotesk-display`, `neue-haas-grotesk-text` and
`linotype-sabon`. It does **not** contain `proxima-nova`, so `-text` is the
secondary face. The Helvetica fallback stack stands alone if the kit fails.

BetterMan headlines are **light** (300–400) and use **italic**, not bold, for
emphasis.

## Ingest

```bash
pnpm ingest:substack                # full archive backfill, both publications
pnpm ingest:substack --incremental  # only posts we do not already have
pnpm ingest:email-imap              # BetterMornings history from the mailbox
pnpm ingest:email-dir <dir>         # …or from saved .eml / .html files
```

Ingest is idempotent: items dedupe on `(sourceId, externalId)`, `contentHash`
detects an upstream edit, and a re-run that finds nothing new writes nothing.
Every run stores what it received in `raw_payloads`, so a parser fix can be
replayed without re-fetching.

### What the sources actually expose

- **Substack.** No credentials, per spec §9. Note the archive endpoint caps each
  response at its own page size and ignores a larger `limit`, so pagination
  advances by the number of rows actually returned. `posts/by-slug` 302s to HTML
  and archive rows carry `body_html: null`, so full bodies are read from the
  `window._preloads` blob on each post page, rate limited to ~1 req/sec.

  Most of Good Trouble is paid-only (**253 of 270** posts), and the public
  endpoints return only a teaser for those. Paywalled posts are skipped rather
  than stored half-complete, so the public archive yields **54 articles**
  (15 Good Trouble, 39 Josiah Jones) — not the 100+ the spec assumed.
  Reaching the rest requires a paid subscriber session.

- **BetterMornings.** `betterman.com/daily-devotional` is a signup page with no
  archive, so the mailbox is the only source of history. `pnpm ingest:email-imap`
  pulls it with an app password (see `.env.example`); live delivery goes to
  `POST /ingest/email`. Both paths share one normalizer, so they cannot drift.

  Two mailbox gotchas the script handles. It reads the `\All` special-use
  mailbox ("[Gmail]/All Mail"), not `INBOX` — archiving a message removes it
  from the inbox, so a backfill against `INBOX` finds almost nothing. And IMAP
  `SEARCH` returns sequence numbers unless UIDs are requested; feeding those to
  a UID fetch matches nothing at all, silently.

  The subscribed mailbox holds **42** messages from `info@betterman.com`, of
  which **34** are devotionals (the rest are other BetterMan mail, skipped by
  sender+subject). Gmail's search UI reports a much larger figure — that is an
  estimate, not a count. Add `--reparse` to replay stored payloads through an
  improved parser.

### The devotional normalizer

The HubSpot template has changed at least twice, so the parser matches on
**labels, not markup** — see `packages/ingest/src/devotional/sections.ts`. What
actually differs between the two eras we have samples of:

| | Nov 2025 | Jul 2026 |
| --- | --- | --- |
| Labels | Scripture / Thought / **Reflection** / **Call to Action** / Prayer | Scripture / Thought / **Reflect** / **Right Next Step** / Prayer |
| Title | plain text | `<strong>` |
| Body nesting | in the rich-text div | one `<div>` deeper |
| CTA order | Subscribe / Connect / Give | Give / Connect / Subscribe |

Both eras are covered by fixture tests and parse at quality **1.000**. Note the
spec described the older era's labels as plain text; the captured Nov/Dec 2025
email wraps them in `<strong>` too, which is exactly why nothing branches on
markup. Anything scoring below **0.9** is held in `REVIEW` instead of published.

The live archive turned up more variation than two eras suggests. Every case
below was holding a real devotional in the review queue, and each is now a
regression test:

| Variant | Seen as |
| --- | --- |
| Reference in brackets | `(Proverbs 26:12)`, `[Genesis 3:9]` |
| Dash with no trailing space | `—Psalm 133:1` |
| `Read:` in place of `Scripture:` | Jul 2026 editions |
| A **Fight Plan** section | autumn 2025, with its own bullet labels |
| Editions with no Reflect section | Sep–Oct 2025 |
| Titles containing a colon | "Rahab: Grace for Outsiders" |

An unknown label only counts as a template change when it is **emphasized and
appears after a section has opened** — otherwise ordinary prose ("Richard
Sibbes observed: …") and colon-bearing titles read as false alarms. Across the
34 devotionals the minimum score is now **0.93** and none are held.

## Replaying the archive

```bash
pnpm reparse                        # every source
pnpm reparse --source bettermornings
```

Applies the current parser and sanitizer to everything already stored, from the
database alone — no network, no credentials. This is what the `raw_payloads`
table exists for, and it is the only way to fix the archive once a mailbox app
password has been revoked.

## PWA and offline

Icons are generated from the committed mark, so there is one piece of artwork:

```bash
pnpm --filter @betterman/web icons
```

The service worker (`apps/web/public/sw.js`) is hand-written and registers in
**production only** — a worker caching pages while you edit them is a debugging
trap. Navigations are network-first with a cached fallback and `/offline` as the
last resort; build assets are cache-first.

`/offline-manifest` returns the URLs of everything published in the last 30
days, and the worker precaches them on activate. It also follows each page into
its JavaScript, CSS and fonts — caching the HTML alone leaves an offline visit
showing a client-side error instead of the piece, and next/font emits Spectral
inside CSS where an HTML-only scan would miss it.

Verified by stopping the server outright: reading pages, in-app navigation and
the offline fallback all resolve from cache.

## Accounts

Standalone email + password accounts, kept behind a thin boundary so SSO
against `betterman.com/_hcms/mem/login` (spec §12) can replace how a session is
*created* without touching how bookmarks, progress or saved steps are read.
`User.passwordHash` is nullable for exactly that reason.

- Passwords use scrypt from Node's own crypto, with the parameters stored
  alongside the hash so they can be raised later without invalidating accounts.
- The session cookie carries a random 256-bit token; the database stores only
  its SHA-256, so a leaked table cannot be replayed as a login.
- Sign-in answers identically for an unknown email and a wrong password, and
  still spends the hashing time on a miss, so the form cannot be used to
  discover which addresses are registered.
- Saved Right Next Steps snapshot the step text. A later upstream edit — or a
  parser improvement — must not rewrite a commitment someone already made.

Not yet built: password reset and email verification, both of which need an
outbound mail provider that is not configured.

## Notifications

Web Push with VAPID. Generate a keypair once and put both halves in `.env`
(the public key twice — the browser needs it to subscribe):

```bash
npx web-push generate-vapid-keys
```

Ingest is the trigger, not a schedule: `upsertItem` fans a notification out to
every subscribed reader the moment a piece is first published, so a devotional
that goes out at an unusual hour still notifies. A worker in `apps/api` then
polls every 30s and delivers each row once its `deliverAfter` passes.

What decides `deliverAfter`:

- The Substacks have no morning ritual, so they go as soon as they land.
- BetterMornings waits for the reader's chosen hour **in their own timezone**.
  If the piece arrives after that hour it goes straight away — a Tuesday
  devotional delivered on Wednesday is wrong — unless it is past 22:00 local,
  in which case it holds for the next morning rather than buzzing a dark
  bedroom.
- Local hours are resolved by probing the zone rather than by adding a fixed
  offset, so the two daylight-saving changeover days land on the hour.

A piece held in `REVIEW` never notifies. The once-per-publication-per-day
debounce claims a `push_logs` row before sending, so two workers cannot both
deliver. Subscriptions answering 404 or 410 are pruned; other failures are not,
since a transient 5xx is not a dead device.

## Phases

Phase 0 (foundation) is complete. Subsequent phases are gated on the previous
one's acceptance criteria; see the build spec.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation — repo, schema, CI, tokens, logos | ✅ |
| 1 | Ingest — RSS backfill, email parser, normalizer | ✅ (see caveats above) |
| 2 | Chrome and archives | ✅ |
| 3 | The three skins | ✅ |
| 4 | PWA + offline | ✅ |
| 5 | Accounts, bookmarks, saved Right Next Steps | ✅ |
| 6 | Notifications | ✅ |
| 7 | Search + Scripture index | |
| 8 | Admin — ingest health, parse review queue | |
| 9 | Launch | |
