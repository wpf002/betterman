-- CreateTable
CREATE TABLE "pending_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "deliverAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "skippedReason" TEXT,

    CONSTRAINT "pending_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_notifications_sentAt_deliverAfter_idx" ON "pending_notifications"("sentAt", "deliverAfter");

-- CreateIndex
CREATE UNIQUE INDEX "pending_notifications_userId_itemId_key" ON "pending_notifications"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
