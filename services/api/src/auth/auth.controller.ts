import { Body, Controller, HttpCode, HttpStatus, Post, Req, UsePipes } from "@nestjs/common";
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

function requestContext(req: Request) {
  return { userAgent: req.headers["user-agent"], ipAddress: req.ip };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // section 69: OTP endpoints get the strictest limits
  @Post("customer/otp/request")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(requestOtpSchema))
  async requestOtp(@Body() body: RequestOtpDto) {
    await this.auth.requestCustomerOtp(body.mobileNumber);
    return { message: "OTP sent" };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("customer/otp/verify")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyCustomerOtp(body.mobileNumber, body.otp, body.name, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("staff/login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(staffLoginSchema))
  async staffLogin(@Body() body: StaffLoginDto, @Req() req: Request) {
    return this.auth.staffLogin(body.email, body.password, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  async refresh(@Body() body: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, requestContext(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  async logout(@Body() body: RefreshTokenDto) {
    await this.auth.logout(body.refreshToken);
    return { message: "Logged out" };
  }
}
