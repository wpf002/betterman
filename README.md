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

## Phases

Phase 0 (foundation) is complete. Subsequent phases are gated on the previous
one's acceptance criteria; see the build spec.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation — repo, schema, CI, tokens, logos | ✅ |
| 1 | Ingest — RSS backfill, email parser, normalizer | |
| 2 | Chrome and archives | |
| 3 | The three skins | |
| 4 | PWA + offline | |
| 5 | Accounts, bookmarks, saved Right Next Steps | |
| 6 | Notifications | |
| 7 | Search + Scripture index | |
| 8 | Admin — ingest health, parse review queue | |
| 9 | Launch | |
