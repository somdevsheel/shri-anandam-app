import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around PrismaClient wired into Nest's lifecycle. Connection
 * pooling (DATABASE_POOL_MIN/MAX) is configured via the `connection_limit`
 * query param on DATABASE_URL — see .env.example / docs/database-architecture.md.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Database connection established");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * The interactive-transaction client type, for typing `tx` parameters in
 * service methods that receive a transaction handle from
 * `prisma.$transaction(async (tx) => { ... })`. Use this — not
 * PrismaService — for every multi-write business operation (order
 * creation, inventory reservation, payment state changes, outbox writes)
 * so the writes commit or roll back atomically together.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
