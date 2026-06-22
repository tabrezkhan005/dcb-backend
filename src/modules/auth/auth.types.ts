import type { Role } from "@prisma/client";
import type { RequestUser } from "../../types/domain";

export type LoginInput = {
  phone: string;
  password: string;
  deviceId: string;
};

export type RefreshInput = {
  refreshToken: string;
};

export type JWTPayload = RequestUser;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginUserSummary {
  id: string;
  name: string;
  role: Role;
  districtId: string;
}
