import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  refreshTokenSchema,
  requestOtpSchema,
  staffLoginSchema,
  verifyOtpSchema,
  type RefreshTokenDto,
  type RequestOtpDto,
  type StaffLoginDto,
  type VerifyOtpDto,
} from "@shri-anandam/validation";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { requestContext } from "../common/util/request-context";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // section 69: OTP endpoints get the strictest limits
  @Post("customer/otp/request")
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpDto) {
    await this.auth.requestCustomerOtp(body.mobileNumber);
    return { message: "OTP sent" };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("customer/otp/verify")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyCustomerOtp(body.mobileNumber, body.otp, body.name, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("staff/login")
  @HttpCode(HttpStatus.OK)
  async staffLogin(@Body(new ZodValidationPipe(staffLoginSchema)) body: StaffLoginDto, @Req() req: Request) {
    return this.auth.staffLogin(body.email, body.password, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, requestContext(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto) {
    await this.auth.logout(body.refreshToken);
    return { message: "Logged out" };
  }
}
