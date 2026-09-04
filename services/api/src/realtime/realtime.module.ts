import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";

/**
 * A private JwtModule registration (not imported from AuthModule, which
 * doesn't export its own) — this module only ever needs to verify a
 * token already issued by AuthService, never sign one, so registering
 * against the same JWT_ACCESS_SECRET here is simpler than adding a new
 * cross-module export for a single method.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>("JWT_ACCESS_SECRET") }),
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
