import { z } from "zod";

export const CreateInstitutionSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(128),
  address: z.string().min(1).max(1024),
  contactName: z.string().min(1).max(255),
  contactPhone: z.string().min(5).max(20),
});

export const UpdateInstitutionSchema = CreateInstitutionSchema.partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field required",
  });

export const InstitutionListQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
