import type { Prisma } from "@prisma/client";
import type { RequestUser } from "../types/domain";

/**
 * Role-based row scoping for simple equality filters.
 * INSPECTOR → { inspectorId }
 * ACCOUNTS → { districtId }
 * ADMIN / CHAIRMAN → unrestricted
 */
export function getScopeFilter(
  user: RequestUser,
):
  | { inspectorId: string }
  | { districtId: string }
  | Record<string, never> {
  if (user.role === "INSPECTOR") {
    return { inspectorId: user.id };
  }
  if (user.role === "ACCOUNTS") {
    return { districtId: user.districtId };
  }
  return {};
}

export function demandNoticeWhereForUser(
  user: RequestUser,
): Prisma.DemandNoticeWhereInput {
  if (user.role === "INSPECTOR") {
    return { inspectorId: user.id };
  }
  if (user.role === "ACCOUNTS") {
    return { districtId: user.districtId };
  }
  return {};
}

export function collectionWhereForUser(
  user: RequestUser,
): Prisma.CollectionWhereInput {
  if (user.role === "INSPECTOR") {
    return { inspectorId: user.id };
  }
  if (user.role === "ACCOUNTS") {
    return { demand: { districtId: user.districtId } };
  }
  return {};
}

export function institutionWhereForUser(
  user: RequestUser,
): Prisma.InstitutionWhereInput {
  if (user.role === "INSPECTOR" || user.role === "ACCOUNTS") {
    return { districtId: user.districtId };
  }
  return {};
}
