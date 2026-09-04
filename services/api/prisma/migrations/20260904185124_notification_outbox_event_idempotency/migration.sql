-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "outboxEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_outboxEventId_deviceId_key" ON "notifications"("outboxEventId", "deviceId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

