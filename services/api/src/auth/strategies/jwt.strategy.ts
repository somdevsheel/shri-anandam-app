import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser, JwtPayload } from "../types/authenticated-user.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  /**
   * Re-verifies the subject is still active on every request rather than
   * trusting the token payload blindly — a deactivated staff account or
   * customer is rejected immediately even with a still-valid access token.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.subjectType === "STAFF") {
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, isActive: true },
      });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException("Staff account is inactive");
      }
      return {
        subjectType: "STAFF",
        id: staff.id,
        email: staff.email,
        permissions: payload.permissions ?? [],
      };
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || !customer.isActive) {
      throw new UnauthorizedException("Customer account is inactive");
    }
    return {
      subjectType: "CUSTOMER",
      id: customer.id,
      mobileNumber: customer.mobileNumber,
    };
  }
}
