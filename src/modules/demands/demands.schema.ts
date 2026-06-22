import { z } from "zod";

export const CreateDemandSchema = z.object({
  institutionId: z.string().uuid(),
  districtId: z.string().uuid(),
  amountDue: z.union([z.number().positive(), z.string()]),
  financialYear: z.string().min(4).max(16),
  dueDate: z.coerce.date(),
});

export const DemandListQuerySchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "COLLECTED", "OVERDUE"]).optional(),
  financialYear: z.string().optional(),
  districtId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const AssignDemandSchema = z.object({
  inspectorId: z.string().uuid(),
});
