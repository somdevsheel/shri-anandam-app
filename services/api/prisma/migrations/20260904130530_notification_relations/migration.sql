-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
