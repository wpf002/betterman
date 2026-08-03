-- Aligns a hand-written index with Prisma's naming convention.
--
-- The index was created by hand as ..._primary_idx; Prisma derives
-- ..._isPrimary_idx from the field name and would otherwise emit this rename
-- into every future migration.
ALTER INDEX IF EXISTS "scripture_refs_book_chapter_primary_idx"
  RENAME TO "scripture_refs_book_chapter_isPrimary_idx";
