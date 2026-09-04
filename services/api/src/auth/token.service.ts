import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedUser, JwtPayload, SubjectType } from "./types/authenticated-user.type";
import ms from "./util/ms";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Issues short-lived JWT access tokens plus long-lived opaque refresh
 * tokens. Refresh tokens are stored server-side (Session table) as a
 * SHA-256 hash — never in plaintext — and rotate on every use: reusing an
 * already-rotated refresh token revokes the entire session family and
 * logs a SecurityEvent (stolen-token detection), per section 66's
 * requirement that tokens not depend on server memory (stateless app
 * servers, shared DB-backed session state).
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokens(
    user: AuthenticatedUser,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<IssuedTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      subjectType: user.subjectType,
      ...(user.subjectType === "STAFF"
        ? { permissions: user.permissions, email: user.email }
        : { mobileNumber: user.mobileNumber }),
    };

    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL", "15m");
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessTtl,
    });

    const refreshToken = randomBytes(48).toString("hex");
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "30d");
    const expiresAt = new Date(Date.now() + ms(refreshTtl));

    await this.prisma.session.create({
      data: {
        customerId: user.subjectType === "CUSTOMER" ? user.id : null,
        staffId: user.subjectType === "STAFF" ? user.id : null,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresIn: ms(accessTtl) / 1000 };
  }

  /**
   * Validates and rotates a refresh token. Returns the subject identity so
   * the caller (AuthService) can re-fetch fresh permissions/roles before
   * issuing new tokens — permissions must never be trusted from the old
   * token itself, only re-derived from the database.
   */
  async rotateRefreshToken(
    refreshToken: string,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<{ id: string; subjectType: SubjectType }> {
    const hash = hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session?.revokedAt) {
        // A previously-rotated (and therefore revoked) refresh token was
        // presented again — likely token theft/replay. Revoke the whole
        // session family for this subject and record where the replay
        // came from for later investigation.
        await this.revokeAllSessionsFor(session);
        await this.prisma.securityEvent.create({
          data: {
            type: "REFRESH_TOKEN_REUSE_DETECTED",
            actorType: session.customerId ? "CUSTOMER" : "STAFF",
            actorId: session.customerId ?? session.staffId,
            ipAddress: context.ipAddress,
            metadata: { userAgent: context.userAgent },
          },
        });
        this.logger.warn(
          `Refresh token reuse detected for ${session.customerId ?? session.staffId} — all sessions revoked`,
        );
      }
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return {
      id: (session.customerId ?? session.staffId) as string,
      subjectType: session.customerId ? "CUSTOMER" : "STAFF",
    };
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const hash = hashToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllSessionsFor(session: { customerId: string | null; staffId: string | null }): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        customerId: session.customerId ?? undefined,
        staffId: session.staffId ?? undefined,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
