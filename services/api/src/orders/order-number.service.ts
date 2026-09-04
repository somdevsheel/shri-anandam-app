import { Injectable } from "@nestjs/common";
import type { PrismaTransactionClient } from "../database/prisma.service";

/**
 * Generates human-friendly order numbers (section 9): SA-YYYYMMDD-NNNN,
 * e.g. SA-20260904-1025. `NNNN` is a per-day sequence advanced via a
 * single atomic `INSERT ... ON CONFLICT DO UPDATE SET counter = counter
 * + 1 RETURNING counter` — Postgres guarantees that statement is
 * race-free under concurrent callers without an explicit row lock (two
 * simultaneous order creations racing here get two different, correctly
 * incrementing counter values, not a lost update).
 */
@Injectable()
export class OrderNumberService {
  async next(tx: PrismaTransactionClient): Promise<string> {
    const today = new Date();
    const dateKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("");

    const rows = await tx.$queryRaw<{ counter: number }[]>`
      INSERT INTO order_sequences (date, counter) VALUES (${dateKey}, 1)
      ON CONFLICT (date) DO UPDATE SET counter = order_sequences.counter + 1
      RETURNING counter
    `;
    const counter = rows[0]?.counter ?? 1;

    return `SA-${dateKey}-${String(counter).padStart(4, "0")}`;
  }
}
