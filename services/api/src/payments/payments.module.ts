import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayWebhookController } from "./webhooks/razorpay-webhook.controller";
import { PAYMENT_PROVIDER } from "./providers/payment-provider.interface";
import { RazorpayPaymentProvider } from "./providers/razorpay-payment.provider";

@Module({
  imports: [InventoryModule],
  controllers: [PaymentsController, RazorpayWebhookController],
  providers: [
    PaymentsService,
    // Every online payment method (UPI/CARD/NET_BANKING) is routed
    // through Razorpay today — swapping or adding a second gateway is a
    // new provider class bound here, not a change to PaymentsService or
    // OrdersService (both depend only on the PaymentProvider interface).
    { provide: PAYMENT_PROVIDER, useClass: RazorpayPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
