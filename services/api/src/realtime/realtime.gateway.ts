import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { Permission } from "@shri-anandam/shared-types";
import { PrismaService } from "../database/prisma.service";
import type { JwtPayload } from "../auth/types/authenticated-user.type";

interface SocketUser {
  subjectType: "STAFF" | "CUSTOMER";
  id: string;
}

/** Every staff socket permitted to receive order events joins this one room — see the room-design note on handleConnection for why this isn't per-branch. */
const STAFF_ORDERS_ROOM = "staff:orders";

/**
 * Phase 11 — live order updates for customer-mobile, admin-web, and
 * kitchen-web, replacing/supplementing the polling those apps shipped
 * with in earlier phases (Phase 9/10). Deliberately in-process rather
 * than outbox-driven (contrast with services/notification-worker's FCM
 * pipeline, Phase 8): a WebSocket client is only ever connected to
 * *this* API process (via the Redis adapter fanning out across
 * replicas — see redis-io.adapter.ts), so there is no "deliver later
 * when the recipient comes back online" requirement the outbox pattern
 * exists for. A missed event because a client was briefly disconnected
 * is corrected by that client's own reconnect + refetch (every
 * consuming screen still has its REST fetch/poll as the source of
 * truth) — the same "DB is authoritative regardless of push delivery"
 * principle as the FCM pipeline, applied to a strictly best-effort
 * transport instead of an at-least-once one.
 */
// Same CORS_ALLOWED_ORIGINS the REST API uses (main.ts's app.enableCors)
// — read directly from process.env because @WebSocketGateway's options
// are evaluated at class-decoration time, before Nest's DI container
// (and therefore ConfigService) exists yet. This repo already fails
// fast at boot if required env vars are missing/invalid
// (services/api/src/config/configuration.ts's `validate`), so
// process.env is trustworthy by the time any module is even imported.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

@Injectable()
@WebSocketGateway({ cors: { origin: allowedOrigins, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.token as string | undefined) ?? (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error("No token provided");

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });

      const user = await this.resolveAndVerifyUser(payload);
      client.data.user = user;

      if (user.subjectType === "STAFF") {
        // Deliberately NOT scoped to this staff member's own BranchStaff
        // rows — caught live while verifying this feature: the seeded
        // bootstrap OWNER account has zero branch assignments (an
        // owner isn't tied to one location), so a per-branch room design
        // silently excluded it from every order event. That isn't a
        // seed-data quirk to work around; it reflects the REST API's own
        // authorization model — OrdersService.listAdmin() applies no
        // branch restriction beyond an optional client-supplied filter,
        // so ANY staff holding order.read can already read ANY branch's
        // orders over REST. The WebSocket room mirrors that exactly:
        // one shared room, gated on the same permission REST checks
        // (OrdersController.list()'s `Permission.ORDER_READ` check),
        // not on which branches this staff member happens to be
        // assigned to.
        if ((payload.permissions ?? []).includes(Permission.ORDER_READ)) {
          await client.join(STAFF_ORDERS_ROOM);
        }
      } else {
        await client.join(`customer:${user.id}`);
      }
    } catch (err) {
      this.logger.warn(`Rejecting WebSocket connection: ${err instanceof Error ? err.message : "invalid token"}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No explicit cleanup needed — socket.io removes a disconnected
    // socket from every room it had joined automatically.
  }

  /** Same re-verify-on-every-use discipline as JwtStrategy.validate() — a still-valid token for a since-deactivated account must not keep receiving live updates. */
  private async resolveAndVerifyUser(payload: JwtPayload): Promise<SocketUser> {
    if (payload.subjectType === "STAFF") {
      const staff = await this.prisma.staff.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true } });
      if (!staff || !staff.isActive) throw new Error("Staff account is inactive");
      return { subjectType: "STAFF", id: staff.id };
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true } });
    if (!customer || !customer.isActive) throw new Error("Customer account is inactive");
    return { subjectType: "CUSTOMER", id: customer.id };
  }

  // -------------------------------------------------------------------
  // Emitters — called by OrdersService after a transaction commits
  // (never from inside one; see docs/architecture/decisions.md's
  // external-call-outside-transaction principle applied here too, even
  // though this is in-process rather than a network call, to keep the
  // rule uniform and because a slow/backpressured socket.io broadcast
  // is exactly the kind of variable-latency operation that principle
  // was written to keep off the transaction's critical path).
  // -------------------------------------------------------------------

  emitOrderCreated(order: { id: string; branchId: string; orderNumber: string; totalInPaise: number; status: string }): void {
    this.server.to(STAFF_ORDERS_ROOM).emit("order:created", order);
  }

  emitOrderUpdated(order: { id: string; branchId: string; customerId: string; orderNumber: string; status: string }): void {
    this.server.to(STAFF_ORDERS_ROOM).emit("order:updated", order);
    this.server.to(`customer:${order.customerId}`).emit("order:updated", order);
  }
}
