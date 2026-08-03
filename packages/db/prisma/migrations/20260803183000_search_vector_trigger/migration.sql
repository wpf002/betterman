-- Converts "items"."searchVector" from a GENERATED column to a plain column
-- maintained by a trigger.
--
-- Not a change of behaviour — the expression is identical — but a change of
-- who owns it. Prisma cannot model a generated column, so it emitted
-- `ALTER COLUMN "searchVector" DROP DEFAULT` into every subsequent migration,
-- which Postgres rejects outright on a generated column. That made every
-- future schema change fail on an unrelated table.
--
-- A trigger is invisible to Prisma's model, so it stops trying to reconcile
-- it, while the column itself is now an ordinary nullable tsvector that
-- Prisma is happy to leave alone.
ALTER TABLE "items" ALTER COLUMN "searchVector" DROP EXPRESSION;

CREATE OR REPLACE FUNCTION items_search_vector_refresh() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."contentText", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BEFORE, so the value is written as part of the same row write. Scoped to the
-- three columns it reads, so unrelated updates do not pay to recompute it.
DROP TRIGGER IF EXISTS items_search_vector_trg ON "items";
CREATE TRIGGER items_search_vector_trg
  BEFORE INSERT OR UPDATE OF "title", "subtitle", "contentText" ON "items"
  FOR EACH ROW EXECUTE FUNCTION items_search_vector_refresh();

-- Rows written before the trigger existed keep whatever the generated column
-- last produced; recompute anyway so the two paths are provably identical.
UPDATE "items" SET "title" = "title";
