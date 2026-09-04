import { z } from "zod";
import { paginationQuerySchema } from "./common.schema";

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDING", "SENT", "DELIVERED", "FAILED", "READ"]).optional(),
});
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
