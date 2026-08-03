-- AlterTable
ALTER TABLE "items" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "scripture_refs" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "items_searchVector_idx" ON "items" USING GIN ("searchVector");
