-- CreateEnum
CREATE TYPE "SourceKey" AS ENUM ('BETTERMORNINGS', 'GOOD_TROUBLE', 'JOSIAH_JONES');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('EMAIL', 'SUBSTACK');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PUBLISHED', 'REVIEW', 'DRAFT');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "key" "SourceKey" NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "homeUrl" TEXT NOT NULL,
    "feedUrl" TEXT,
    "apiHost" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "canonicalUrl" TEXT,
    "heroImageUrl" TEXT,
    "contentHtml" TEXT NOT NULL,
    "contentText" TEXT,
    "contentHash" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devotionals" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scriptureText" TEXT,
    "scriptureRef" TEXT,
    "thought" TEXT,
    "reflect" TEXT,
    "rightNextStep" TEXT,
    "prayer" TEXT,
    "parseQuality" DOUBLE PRECISION NOT NULL,
    "templateEra" TEXT,
    "unmatched" JSONB,

    CONSTRAINT "devotionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripture_refs" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verseStart" INTEGER,
    "verseEnd" INTEGER,
    "displayRef" TEXT NOT NULL,

    CONSTRAINT "scripture_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "trigger" TEXT NOT NULL,
    "status" "IngestStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsInReview" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ingest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_payloads" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "runId" TEXT,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "body" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "deliverHour" INTEGER DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "itemId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_next_steps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "stepText" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_next_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_key_key" ON "sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sources_slug_key" ON "sources"("slug");

-- CreateIndex
CREATE INDEX "items_sourceId_publishedAt_idx" ON "items"("sourceId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "items_status_publishedAt_idx" ON "items"("status", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "items_sourceId_externalId_key" ON "items"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "items_sourceId_slug_key" ON "items"("sourceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "devotionals_itemId_key" ON "devotionals"("itemId");

-- CreateIndex
CREATE INDEX "devotionals_date_idx" ON "devotionals"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "devotionals_date_key" ON "devotionals"("date");

-- CreateIndex
CREATE INDEX "scripture_refs_book_chapter_idx" ON "scripture_refs"("book", "chapter");

-- CreateIndex
CREATE INDEX "scripture_refs_itemId_idx" ON "scripture_refs"("itemId");

-- CreateIndex
CREATE INDEX "ingest_runs_sourceId_startedAt_idx" ON "ingest_runs"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "raw_payloads_kind_receivedAt_idx" ON "raw_payloads"("kind", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "raw_payloads_externalId_idx" ON "raw_payloads"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_userId_sourceId_key" ON "notification_prefs"("userId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_logs_userId_sourceId_localDate_key" ON "push_logs"("userId", "sourceId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_itemId_key" ON "bookmarks"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_userId_itemId_key" ON "reading_progress"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_next_steps_userId_itemId_key" ON "saved_next_steps"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devotionals" ADD CONSTRAINT "devotionals_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripture_refs" ADD CONSTRAINT "scripture_refs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ingest_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_logs" ADD CONSTRAINT "push_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_logs" ADD CONSTRAINT "push_logs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_next_steps" ADD CONSTRAINT "saved_next_steps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_next_steps" ADD CONSTRAINT "saved_next_steps_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
