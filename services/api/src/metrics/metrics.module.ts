import { Global, Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsUpdaterService } from "./metrics-updater.service";
import { MetricsMiddleware } from "./metrics.middleware";

/**
 * @Global() — matching RedisModule/AuditModule's precedent for
 * cross-cutting infrastructure every other module might eventually want
 * to record a custom metric through, without each one re-importing this.
 * MetricsMiddleware itself is applied in AppModule.configure() (it must
 * run before Guards — see its own comment — which requires it to be
 * middleware wired at the module-graph root, not a provider some other
 * module pulls in).
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsUpdaterService, MetricsMiddleware],
  exports: [MetricsService, MetricsMiddleware],
})
export class MetricsModule {}
