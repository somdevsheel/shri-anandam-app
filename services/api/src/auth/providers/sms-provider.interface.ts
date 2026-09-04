export const SMS_PROVIDER = "SMS_PROVIDER";

/**
 * Abstraction over the OTP/SMS delivery provider so a real provider
 * (MSG91, Twilio, etc.) can be swapped in per environment without
 * touching OtpService. Configured via SMS_PROVIDER in .env.
 */
export interface SmsProvider {
  sendOtp(mobileNumber: string, otp: string): Promise<void>;
}
