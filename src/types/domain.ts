export type Role = "INSPECTOR" | "ACCOUNTS" | "ADMIN" | "CHAIRMAN";

export interface RequestUser {
  id: string;
  name: string;
  role: Role;
  districtId: string;
  deviceId: string;
}
