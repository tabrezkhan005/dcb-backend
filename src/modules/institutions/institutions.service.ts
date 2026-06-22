import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { writeAuditLog } from "../../middleware/auditLog";
import { institutionWhereForUser } from "../../middleware/scopeQuery";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

export async function getInstitutions(
  user: RequestUser,
  filters: { search?: string; isActive?: boolean },
) {
  try {
    const scoped = institutionWhereForUser(user);
    const where: Prisma.InstitutionWhereInput = {
      ...scoped,
      ...(filters.search !== undefined && filters.search.length > 0
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { contactName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };

    return await prisma.institution.findMany({
      where,
      orderBy: { name: "asc" },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to list institutions",
      500,
    );
  }
}

export async function getInstitutionById(id: string, user: RequestUser) {
  try {
    const row = await prisma.institution.findUnique({ where: { id } });
    if (row === null) {
      throw AppError.notFound("Institution not found");
    }
    if (user.role === "INSPECTOR" || user.role === "ACCOUNTS") {
      if (row.districtId !== user.districtId) {
        throw AppError.forbidden("Institution not in your district");
      }
    }
    return row;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load institution",
      500,
    );
  }
}

export async function createInstitution(
  data: {
    districtId: string;
    name: string;
    category: string;
    address: string;
    contactName: string;
    contactPhone: string;
  },
  adminUser: RequestUser,
) {
  try {
    const district = await prisma.district.findUnique({
      where: { id: data.districtId },
    });
    if (district === null) {
      throw AppError.badRequest("Invalid district");
    }
    const created = await prisma.institution.create({ data });
    void writeAuditLog({
      userId: adminUser.id,
      action: "INSTITUTION_CREATE",
      entityType: "Institution",
      entityId: created.id,
      afterData: created as unknown as Prisma.InputJsonValue,
    });
    return created;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to create institution",
      500,
    );
  }
}

export async function updateInstitution(
  id: string,
  data: Partial<{
    districtId: string;
    name: string;
    category: string;
    address: string;
    contactName: string;
    contactPhone: string;
    isActive: boolean;
  }>,
  adminUser: RequestUser,
) {
  try {
    const existing = await prisma.institution.findUnique({ where: { id } });
    if (existing === null) {
      throw AppError.notFound("Institution not found");
    }
    const updated = await prisma.institution.update({
      where: { id },
      data,
    });
    void writeAuditLog({
      userId: adminUser.id,
      action: "INSTITUTION_UPDATE",
      entityType: "Institution",
      entityId: id,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to update institution",
      500,
    );
  }
}
