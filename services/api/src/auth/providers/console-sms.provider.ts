import { Injectable, Logger } from "@nestjs/common";
import type { SmsProvider } from "./sms-provider.interface";

/**
 * Development-only SMS provider: logs the OTP instead of sending a real
 * SMS. NEVER used in staging/production — those environments must wire a
 * real provider (e.g. MSG91) behind this same interface. See
 * docs/architecture/security-architecture.md.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger("SMS[dev]");

  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ConsoleSmsProvider must never be used in production — configure a real SMS_PROVIDER",
      );
    }
    this.logger.warn(`[DEV ONLY] OTP for ${mobileNumber}: ${otp}`);
  }
}
