import { z } from "zod";

export const ExportRequestSchema = z.object({
  type: z.enum(["dcb", "collections", "demands"]),
  filters: z.record(z.string(), z.unknown()).default({}),
});
