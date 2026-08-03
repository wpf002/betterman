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

## Phases

Phase 0 (foundation) is complete. Subsequent phases are gated on the previous
one's acceptance criteria; see the build spec.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation — repo, schema, CI, tokens, logos | ✅ |
| 1 | Ingest — RSS backfill, email parser, normalizer | ✅ (see caveats above) |
| 2 | Chrome and archives | |
| 3 | The three skins | |
| 4 | PWA + offline | |
| 5 | Accounts, bookmarks, saved Right Next Steps | |
| 6 | Notifications | |
| 7 | Search + Scripture index | |
| 8 | Admin — ingest health, parse review queue | |
| 9 | Launch | |
