import { Injectable, OnModuleInit } from "@nestjs/common";
import * as client from "prom-client";

/**
 * Phase 12 (docs/architecture/production-architecture.md's Observability
 * section names this explicitly: "request latency/error histograms,
 * queue backlog, DB/Redis latency"). One registry, process-wide —
 * `collectDefaultMetrics()` adds Node's own process/GC/event-loop
 * metrics for free; everything below is this app's own.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    // Bucketed for a request-response API, not a streaming one — most
    // requests should land well under 250ms; the long tail (500ms-2s)
    // still gets resolution since that's the "is something actually
    // wrong" range an alert would fire on.
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [],
  });

  readonly httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [],
  });

  readonly outboxBacklog = new client.Gauge({
    name: "outbox_pending_events",
    help: "OutboxEvent rows currently PENDING — services/notification-worker's queue backlog",
    registers: [],
  });

  readonly activeStockReservations = new client.Gauge({
    name: "inventory_active_reservations",
    help: "Non-expired StockReservation rows — a proxy for checkout-in-progress load",
    registers: [],
  });

  onModuleInit(): void {
    client.collectDefaultMetrics({ register: this.registry });
    this.registry.registerMetric(this.httpRequestDuration);
    this.registry.registerMetric(this.httpRequestsTotal);
    this.registry.registerMetric(this.outboxBacklog);
    this.registry.registerMetric(this.activeStockReservations);
  }
}
