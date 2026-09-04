import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OtpService } from "./otp.service";
import { TokenService, type IssuedTokens } from "./token.service";
import { PasswordService } from "./password.service";
import type { AuthenticatedUser } from "./types/authenticated-user.type";
import type { Permission } from "@shri-anandam/shared-types";
import { AppError } from "../common/errors/app.error";
import { ErrorCode } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";

interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly password: PasswordService,
  ) {}

  async requestCustomerOtp(mobileNumber: string): Promise<void> {
    await this.otp.requestOtp(mobileNumber);
  }

  async verifyCustomerOtp(
    mobileNumber: string,
    otp: string,
    name: string | undefined,
    ctx: RequestContext,
  ): Promise<IssuedTokens> {
    const isValid = await this.otp.verifyOtp(mobileNumber, otp);
    if (!isValid) {
      await this.recordLoginAttempt(mobileNumber, "CUSTOMER", false, ctx);
      throw new AppError(ErrorCode.UNAUTHORIZED, "Incorrect OTP", HttpStatus.UNAUTHORIZED);
    }

    const customer = await this.prisma.customer.upsert({
      where: { mobileNumber },
      update: name ? { name } : {},
      create: { mobileNumber, name },
    });

    if (!customer.isActive) {
      throw new AppError(ErrorCode.FORBIDDEN, "This account has been deactivated", HttpStatus.FORBIDDEN);
    }

    await this.recordLoginAttempt(mobileNumber, "CUSTOMER", true, ctx);

    const user: AuthenticatedUser = {
      subjectType: "CUSTOMER",
      id: customer.id,
      mobileNumber: customer.mobileNumber,
    };
    return this.tokens.issueTokens(user, ctx);
  }

  async staffLogin(email: string, plaintextPassword: string, ctx: RequestContext): Promise<IssuedTokens> {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { staffRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    const valid = staff ? await this.password.verify(staff.passwordHash, plaintextPassword) : false;

    if (!staff || !valid || !staff.isActive) {
      await this.recordLoginAttempt(email, "STAFF", false, ctx);
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.recordLoginAttempt(email, "STAFF", true, ctx);
    await this.prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

    const permissions = Array.from(
      new Set(
        staff.staffRoles.flatMap((sr) => sr.role.rolePermissions.map((rp) => rp.permission.key as Permission)),
      ),
    );

    const user: AuthenticatedUser = {
      subjectType: "STAFF",
      id: staff.id,
      email: staff.email,
      permissions,
    };
    return this.tokens.issueTokens(user, ctx);
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<IssuedTokens> {
    const { id, subjectType } = await this.tokens.rotateRefreshToken(refreshToken, ctx);

    if (subjectType === "CUSTOMER") {
      const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id } });
      return this.tokens.issueTokens(
        { subjectType: "CUSTOMER", id: customer.id, mobileNumber: customer.mobileNumber },
        ctx,
      );
    }

    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id },
      include: { staffRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    const permissions = Array.from(
      new Set(staff.staffRoles.flatMap((sr) => sr.role.rolePermissions.map((rp) => rp.permission.key as Permission))),
    );
    return this.tokens.issueTokens({ subjectType: "STAFF", id: staff.id, email: staff.email, permissions }, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeByRefreshToken(refreshToken);
  }

  private async recordLoginAttempt(
    identifier: string,
    actorType: "CUSTOMER" | "STAFF",
    success: boolean,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: { identifier, actorType, success, userAgent: ctx.userAgent, ipAddress: ctx.ipAddress },
    });
  }
}
