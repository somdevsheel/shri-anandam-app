import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { AdminCustomersController } from "./admin-customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [CustomersController, AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
