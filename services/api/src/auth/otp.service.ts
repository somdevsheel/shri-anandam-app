import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomInt } from "node:crypto";
import { RedisService } from "../redis/redis.service";
import { AppError } from "../common/errors/app.error";
import { ErrorCode } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";
import { SMS_PROVIDER, type SmsProvider } from "./providers/sms-provider.interface";

interface OtpRecord {
  otpHash: string;
  attempts: number;
}

/**
 * OTP generation/verification backed by Redis (never the database — OTPs
 * are short-lived, high-write, and must not linger). Enforces:
 *  - a resend cooldown (OTP_RESEND_COOLDOWN_SECONDS)
 *  - a max verification attempt count (OTP_MAX_ATTEMPTS) before the OTP
 *    is invalidated, mitigating brute force
 *  - TTL-based expiry (OTP_TTL_SECONDS)
 * This is on top of, not instead of, the IP/endpoint-level rate limiting
 * applied via ThrottlerGuard on the controller route (section 69).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly otpLength: number;
  private readonly ttlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxAttempts: number;
  private readonly bypassCode: string | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {
    this.otpLength = this.config.get<number>("OTP_LENGTH", 6);
    this.ttlSeconds = this.config.get<number>("OTP_TTL_SECONDS", 300);
    this.resendCooldownSeconds = this.config.get<number>("OTP_RESEND_COOLDOWN_SECONDS", 30);
    this.maxAttempts = this.config.get<number>("OTP_MAX_ATTEMPTS", 5);
    this.bypassCode = this.config.get<string>("OTP_BYPASS_CODE") || undefined;

    if (this.bypassCode) {
      this.logger.warn(
        `OTP_BYPASS_CODE is set — any phone number can log in with this fixed code, no real OTP verification happens. This must be unset once a real SMS provider is configured (see .env.example).`,
      );
    }
  }

  private otpKey(mobileNumber: string): string {
    return `otp:${mobileNumber}`;
  }

  private cooldownKey(mobileNumber: string): string {
    return `otp:cooldown:${mobileNumber}`;
  }

  async requestOtp(mobileNumber: string): Promise<void> {
    const onCooldown = await this.redis.get(this.cooldownKey(mobileNumber));
    if (onCooldown) {
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        `Please wait before requesting another OTP`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const record: OtpRecord = { otpHash: hashOtp(otp), attempts: 0 };
    await this.redis.setWithTtl(this.otpKey(mobileNumber), JSON.stringify(record), this.ttlSeconds);
    await this.redis.setWithTtl(this.cooldownKey(mobileNumber), "1", this.resendCooldownSeconds);

    if (this.bypassCode) {
      // Skip the real provider entirely — ConsoleSmsProvider (the only
      // one ever actually wired up, see AuthModule) throws by design in
      // production, and this path exists specifically for when no real
      // provider is configured yet. The real generated OTP is still
      // logged here (in addition to OTP_BYPASS_CODE itself working in
      // verifyOtp), so either one lets you in.
      this.logger.warn(`OTP bypass active — real OTP for ${mobileNumber} is ${otp} (or use OTP_BYPASS_CODE)`);
      return;
    }

    await this.smsProvider.sendOtp(mobileNumber, otp);
  }

  async verifyOtp(mobileNumber: string, otp: string): Promise<boolean> {
    if (this.bypassCode && otp === this.bypassCode) {
      this.logger.warn(`OTP bypass code used to verify ${mobileNumber} — no real OTP was checked`);
      await this.redis.del(this.otpKey(mobileNumber));
      return true;
    }

    const raw = await this.redis.get(this.otpKey(mobileNumber));
    if (!raw) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "OTP expired or not requested", HttpStatus.BAD_REQUEST);
    }

    const record: OtpRecord = JSON.parse(raw);

    if (record.attempts >= this.maxAttempts) {
      await this.redis.del(this.otpKey(mobileNumber));
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Too many incorrect attempts — request a new OTP",
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = record.otpHash === hashOtp(otp);
    if (!isValid) {
      record.attempts += 1;
      await this.redis.setWithTtl(this.otpKey(mobileNumber), JSON.stringify(record), this.ttlSeconds);
      return false;
    }

    await this.redis.del(this.otpKey(mobileNumber));
    return true;
  }

  private generateOtp(): string {
    const max = 10 ** this.otpLength;
    return randomInt(0, max).toString().padStart(this.otpLength, "0");
  }
}

function hashOtp(otp: string): string {
  // OTPs are short-lived, low-entropy, single-use secrets — a fast keyed
  // hash (not a slow password KDF) is appropriate here since brute force
  // is already bounded by maxAttempts + TTL, not by hash cost.
  return createHash("sha256").update(otp).digest("hex");
}
