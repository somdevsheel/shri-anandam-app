import { z } from "zod";
import { paginationQuerySchema } from "./common.schema";
import { uuidSchema } from "./common.schema";

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().trim().max(100).optional(),
  entityId: uuidSchema.optional(),
  actorId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
