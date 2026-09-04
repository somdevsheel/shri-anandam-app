import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerErrorInterceptor } from "nestjs-pino";

import { validate } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { LoggerModule } from "./logger/logger.module";
import { OutboxModule } from "./outbox/outbox.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { BranchesModule } from "./branches/branches.module";
import { StaffModule } from "./staff/staff.module";
import { RolesModule } from "./roles/roles.module";

import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>("RATE_LIMIT_TTL_SECONDS", 60) * 1000,
            limit: config.get<number>("RATE_LIMIT_MAX_REQUESTS", 100),
          },
        ],
      }),
    }),
    LoggerModule,
    PrismaModule,
    RedisModule,
    OutboxModule,
    HealthModule,
    AuthModule,
    AuditModule,
    OrganizationsModule,
    BranchesModule,
    StaffModule,
    RolesModule,
    // Catalog, Cart, Orders, Payments, Inventory, Delivery, Coupons,
    // Notifications, and Reviews modules are added in their respective
    // implementation phases (see docs/architecture).
  ],
  providers: [
    // Order matters: ThrottlerGuard -> JwtAuthGuard -> PermissionsGuard.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggerErrorInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
