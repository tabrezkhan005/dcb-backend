import bcrypt from "bcryptjs";
import type { Prisma, Role } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../../config/database";
import { redisHelpers } from "../../config/redis";
import { writeAuditLog } from "../../middleware/auditLog";
import { notifyInspectorTransferred } from "../notifications/notification.service";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

const BCRYPT_ROUNDS = 12;

export async function getUsers(filters: {
  role?: Role;
  districtId?: string;
  isActive?: boolean;
  search?: string;
}) {
  try {
    const where: Prisma.UserWhereInput = {
      ...(filters.role !== undefined ? { role: filters.role } : {}),
      ...(filters.districtId !== undefined
        ? { districtId: filters.districtId }
        : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.search !== undefined && filters.search.length > 0
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search } },
            ],
          }
        : {}),
    };
    return await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        districtId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        district: { select: { id: true, name: true, code: true } },
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to list users",
      500,
    );
  }
}

export async function getUserById(id: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        districtId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        district: { select: { id: true, name: true, code: true } },
      },
    });
    if (user === null) {
      throw AppError.notFound("User not found");
    }
    return user;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load user",
      500,
    );
  }
}

export async function getUserActivity(id: string) {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return rows;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load activity",
      500,
    );
  }
}

export async function listAuditLogs() {
  try {
    return await prisma.auditLog.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, role: true, phone: true },
        },
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to list audit logs",
      500,
    );
  }
}

export async function createUser(
  data: {
    districtId: string;
    name: string;
    phone: string;
    email?: string | null;
    password: string;
    role: Role;
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
    const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const created = await prisma.user.create({
      data: {
        districtId: data.districtId,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        password: hash,
        role: data.role,
      },
      select: {
        id: true,
        districtId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        district: { select: { id: true, name: true, code: true } },
      },
    });
    void writeAuditLog({
      userId: adminUser.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: created.id,
      afterData: created as unknown as Prisma.InputJsonValue,
    });
    return created;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict("Phone already registered");
    }
    throw new AppError(
      err instanceof Error ? err.message : "Failed to create user",
      500,
    );
  }
}

export async function updateUser(
  id: string,
  data: Partial<{
    districtId: string;
    name: string;
    email: string | null;
    password: string;
    role: Role;
    isActive: boolean;
  }>,
  adminUser: RequestUser,
) {
  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing === null) {
      throw AppError.notFound("User not found");
    }
    let password = undefined as string | undefined;
    if (data.password !== undefined) {
      password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        districtId: data.districtId,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        ...(password !== undefined ? { password } : {}),
      },
      select: {
        id: true,
        districtId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
        district: { select: { id: true, name: true, code: true } },
      },
    });
    void writeAuditLog({
      userId: adminUser.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to update user",
      500,
    );
  }
}

export async function transferInspector(
  userId: string,
  newDistrictId: string,
  notes: string | undefined,
  adminUser: RequestUser,
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user === null || user.role !== "INSPECTOR") {
      throw AppError.badRequest("User is not an inspector");
    }
    const newDistrict = await prisma.district.findUnique({
      where: { id: newDistrictId },
    });
    if (newDistrict === null) {
      throw AppError.badRequest("Invalid district");
    }
    const oldDistrictId = user.districtId;

    const result = await prisma.$transaction(async (tx) => {
      await tx.demandNotice.updateMany({
        where: {
          inspectorId: userId,
          status: "PENDING",
        },
        data: { inspectorId: null },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { districtId: newDistrictId },
        select: {
          id: true,
          districtId: true,
          name: true,
          phone: true,
          role: true,
          district: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.transferLog.create({
        data: {
          userId,
          fromDistrictId: oldDistrictId,
          toDistrictId: newDistrictId,
          transferredBy: adminUser.id,
          notes: notes ?? null,
        },
      });

      return updated;
    });

    await redisHelpers.del(`dcb:refresh:${userId}`);

    void notifyInspectorTransferred(userId, newDistrict.name);

    void writeAuditLog({
      userId: adminUser.id,
      action: "INSPECTOR_TRANSFER",
      entityType: "User",
      entityId: userId,
      beforeData: { districtId: oldDistrictId } as Prisma.InputJsonValue,
      afterData: { districtId: newDistrictId } as Prisma.InputJsonValue,
    });

    return result;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to transfer inspector",
      500,
    );
  }
}

export async function deactivateUser(id: string, adminUser: RequestUser) {
  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing === null) {
      throw AppError.notFound("User not found");
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        isActive: true,
        name: true,
        phone: true,
        role: true,
      },
    });
    await redisHelpers.del(`dcb:refresh:${id}`);
    void writeAuditLog({
      userId: adminUser.id,
      action: "USER_DEACTIVATE",
      entityType: "User",
      entityId: id,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to deactivate user",
      500,
    );
  }
}

/** Clears device binding so the user can sign in from a new phone. */
export async function resetUserDevice(id: string, adminUser: RequestUser) {
  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing === null) {
      throw AppError.notFound("User not found");
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { deviceId: null },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        districtId: true,
        isActive: true,
        district: { select: { id: true, name: true, code: true } },
      },
    });
    await redisHelpers.del(`dcb:refresh:${id}`);
    void writeAuditLog({
      userId: adminUser.id,
      action: "USER_DEVICE_RESET",
      entityType: "User",
      entityId: id,
      beforeData: { deviceId: existing.deviceId } as Prisma.InputJsonValue,
      afterData: { deviceId: null } as Prisma.InputJsonValue,
    });
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to reset device",
      500,
    );
  }
}
