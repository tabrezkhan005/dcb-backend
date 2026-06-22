import { z } from "zod";

const RoleSchema = z.enum([
  "INSPECTOR",
  "ACCOUNTS",
  "ADMIN",
  "CHAIRMAN",
]);

export const UserListQuerySchema = z.object({
  role: RoleSchema.optional(),
  districtId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

export const CreateUserSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8).max(128),
  role: RoleSchema,
});

export const UpdateUserSchema = z
  .object({
    districtId: z.string().uuid().optional(),
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    password: z.string().min(8).max(128).optional(),
    role: RoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field required",
  });

export const TransferInspectorSchema = z.object({
  newDistrictId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
