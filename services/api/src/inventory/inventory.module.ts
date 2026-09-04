import { Module } from "@nestjs/common";
import { InventoryController, ProductionBatchesController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { InventoryReservationService } from "./inventory-reservation.service";

@Module({
  controllers: [InventoryController, ProductionBatchesController],
  providers: [InventoryService, InventoryReservationService],
  exports: [InventoryService, InventoryReservationService],
})
export class InventoryModule {}
