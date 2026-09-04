import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { CartModule } from "../cart/cart.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderNumberService } from "./order-number.service";
import { DeliveryFeeService } from "./delivery-fee.service";

@Module({
  imports: [InventoryModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberService, DeliveryFeeService],
  exports: [OrdersService],
})
export class OrdersModule {}
