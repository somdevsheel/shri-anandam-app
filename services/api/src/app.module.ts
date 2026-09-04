import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
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
import { CategoriesModule } from "./categories/categories.module";
import { ProductsModule } from "./products/products.module";
import { AddonsModule } from "./addons/addons.module";
import { CatalogModule } from "./catalog/catalog.module";
import { InventoryModule } from "./inventory/inventory.module";
import { CustomersModule } from "./customers/customers.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { DevicesModule } from "./devices/devices.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RealtimeModule } from "./realtime/realtime.module";

import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
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
    CategoriesModule,
    ProductsModule,
    AddonsModule,
    CatalogModule,
    InventoryModule,
    CustomersModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    DevicesModule,
    NotificationsModule,
    RealtimeModule,
    // Delivery, Coupons, and Reviews modules are added in their
    // respective implementation phases (see docs/architecture).
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
