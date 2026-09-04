import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { PrismaTransactionClient } from "../database/prisma.service";

/**
 * Deliberately narrower than the full `AuthenticatedUser` union —
 * record() only ever reads `subjectType`/`id`, so callers that only
 * have a minimal actor reference (e.g. OrdersService's status-transition
 * actor, which isn't a full re-authenticated principal) don't need to
 * fabricate the rest of AuthenticatedStaff/AuthenticatedCustomer's
 * shape (permissions, email, mobileNumber) just to log an action.
 */
type AuditActor = { subjectType: "STAFF" | "CUSTOMER"; id: string } | { subjectType: "SYSTEM" };

interface RecordAuditEntryInput {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes AuditLog rows for sensitive administrative actions (section 45):
 * price changes, refunds, order cancellations, inventory adjustments,
 * staff/permission changes, coupon creation, product deletion, payment
 * modification. Every write goes through this service rather than ad-hoc
 * `prisma.auditLog.create()` calls so the shape (and the requirement that
 * every sensitive mutation logs one) stays consistent.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pass `tx` (the transaction handle from the surrounding business
   * operation) when the audit entry must commit atomically with the
   * change it describes — which is the normal case. Falls back to
   * `this.prisma` for read-only-adjacent actions (e.g. login attempts)
   * that aren't already inside a transaction.
   */
  async record(input: RecordAuditEntryInput, tx: PrismaTransactionClient | PrismaService = this.prisma): Promise<void> {
    const actorType = input.actor.subjectType;
    const actorId = input.actor.subjectType === "SYSTEM" ? null : input.actor.id;

    await tx.auditLog.create({
      data: {
        actorId,
        actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: toJsonInput(input.oldValue),
        newValue: toJsonInput(input.newValue),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}
