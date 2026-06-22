import { z } from "zod";

export const DcbReportQuerySchema = z.object({
  districtId: z.string().uuid().optional(),
  financialYear: z.string().min(4).max(16),
  institutionId: z.string().uuid().optional(),
});

export const AnalyticsQuerySchema = z.object({
  financialYear: z.string().min(4).max(16),
});

export const InspectorReportQuerySchema = z.object({
  financialYear: z.string().min(4).max(16).optional(),
});
