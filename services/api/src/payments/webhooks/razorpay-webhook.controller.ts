import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "../payments.service";
import { Public } from "../../common/decorators/public.decorator";

/**
 * Called by Razorpay's servers, not an authenticated user — @Public()
 * bypasses the JWT guard, and the HMAC signature check inside
 * PaymentsService.handleWebhook() is the actual authentication
 * mechanism (section 13). Requires the RAW request body (not the
 * JSON-parsed one) to verify that signature correctly — see main.ts's
 * `rawBody: true` NestFactory option, which is what makes
 * `req.rawBody` available here.
 */
@Controller("payments/webhooks")
export class RazorpayWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post("razorpay")
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: Request & { rawBody?: Buffer }, @Headers("x-razorpay-signature") signature: string | undefined) {
    if (!req.rawBody) {
      // Should be unreachable given main.ts's rawBody config, but fail
      // loudly rather than silently treating an unverifiable body as valid.
      throw new Error("Raw request body was not captured — check main.ts rawBody configuration");
    }
    const result = await this.payments.handleWebhook(req.rawBody, signature);
    return result;
  }
}
