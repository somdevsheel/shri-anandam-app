import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";
import { TokenService } from "./token.service";
import { PasswordService } from "./password.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { SMS_PROVIDER } from "./providers/sms-provider.interface";
import { ConsoleSmsProvider } from "./providers/console-sms.provider";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_ACCESS_TTL", "15m") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    PasswordService,
    JwtStrategy,
    // Swap for a real provider (MSG91Provider, TwilioProvider, ...) per
    // environment — see docs/architecture/notification-architecture.md.
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
