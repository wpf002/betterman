-- Converts "items"."searchVector" into a GENERATED column.
--
-- The previous migration added it as a plain tsvector, which nothing would
-- ever populate. A generated column is recomputed by Postgres on every write,
-- so the index cannot fall out of step with the text it indexes — including
-- after a `pnpm reparse`, which rewrites contentText in bulk without going
-- anywhere near this column.
--
-- Weighted so a phrase in a headline outranks the same phrase buried in a
-- body, which is what makes "a phrase search returns its devotional first"
-- hold in practice.
--   A  title
--   B  subtitle
--   C  body text
DROP INDEX IF EXISTS "items_searchVector_idx";
ALTER TABLE "items" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "items" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("contentText", '')), 'C')
  ) STORED;

CREATE INDEX "items_searchVector_idx" ON "items" USING GIN ("searchVector");

-- Browsing by book and chapter is the Scripture index's whole access pattern.
CREATE INDEX IF NOT EXISTS "scripture_refs_book_chapter_primary_idx"
  ON "scripture_refs" ("book", "chapter", "isPrimary");
