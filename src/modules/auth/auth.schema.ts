import { z } from "zod";

export const LoginSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(1),
  deviceId: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const PushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
