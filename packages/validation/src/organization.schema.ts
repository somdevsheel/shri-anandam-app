import { z } from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;
