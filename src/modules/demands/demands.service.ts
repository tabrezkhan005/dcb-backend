import type { DemandStatus } from "@prisma/client";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { writeAuditLog } from "../../middleware/auditLog";
import { demandNoticeWhereForUser } from "../../middleware/scopeQuery";
import { notifyInspectorNewDemand } from "../notifications/notification.service";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

type Db = PrismaClient | Prisma.TransactionClient;
export async function updateDemandStatus(
  demandId: string,
  db: Db = prisma,
): Promise<void> {
  const demand = await db.demandNotice.findUnique({
    where: { id: demandId },
    include: {
      collections: { where: { status: "ACCEPTED" } },
    },
  });
  if (demand === null) {
    return;
  }

  let sum = new Prisma.Decimal(0);
  for (const c of demand.collections) {
    sum = sum.plus(c.amountCollected);
  }

  const due = demand.amountDue;
  let status: Prisma.DemandNoticeUpdateInput["status"];
  if (sum.greaterThanOrEqualTo(due)) {
    status = "COLLECTED";
  } else if (sum.greaterThan(0)) {
    status = "PARTIAL";
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(demand.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    status = today > dueDate ? "OVERDUE" : "PENDING";
  }

  await db.demandNotice.update({
    where: { id: demandId },
    data: { status },
  });
}

export async function getDemands(
  user: RequestUser,
  filters: {
    status?: DemandStatus;
    financialYear?: string;
    districtId?: string;
    search?: string;
  },
) {
  try {
    const scope = demandNoticeWhereForUser(user);
    const where: Prisma.DemandNoticeWhereInput = {
      ...scope,
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(filters.financialYear !== undefined
        ? { financialYear: filters.financialYear }
        : {}),
      ...(filters.districtId !== undefined &&
      (user.role === "ADMIN" || user.role === "CHAIRMAN")
        ? { districtId: filters.districtId }
        : {}),
      ...(filters.search !== undefined && filters.search.length > 0
        ? {
            institution: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          }
        : {}),
    };

    return await prisma.demandNotice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        institution: { select: { id: true, name: true, districtId: true } },
        inspector: { select: { id: true, name: true } },
        district: { select: { id: true, name: true, code: true } },
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to list demands",
      500,
    );
  }
}

export async function getDemandById(id: string, user: RequestUser) {
  try {
    const row = await prisma.demandNotice.findUnique({
      where: { id },
      include: {
        institution: true,
        inspector: { select: { id: true, name: true, phone: true } },
        district: true,
        collections: {
          orderBy: { submittedAt: "desc" },
          include: {
            inspector: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (row === null) {
      throw AppError.notFound("Demand not found");
    }
    if (user.role === "INSPECTOR" && row.inspectorId !== user.id) {
      throw AppError.forbidden("Demand not assigned to you");
    }
    if (user.role === "ACCOUNTS" && row.districtId !== user.districtId) {
      throw AppError.forbidden("Demand not in your district");
    }
    return row;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load demand",
      500,
    );
  }
}

export async function createDemand(
  data: {
    institutionId: string;
    districtId: string;
    amountDue: string | number;
    financialYear: string;
    dueDate: Date;
  },
  createdBy: RequestUser,
) {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });
    if (institution === null) {
      throw AppError.badRequest("Institution not found");
    }
    if (institution.districtId !== data.districtId) {
      throw AppError.badRequest("Institution is not in the selected district");
    }

    const amountDue = new Prisma.Decimal(data.amountDue);

    const created = await prisma.demandNotice.create({
      data: {
        institutionId: data.institutionId,
        districtId: data.districtId,
        amountDue,
        financialYear: data.financialYear,
        dueDate: data.dueDate,
        createdBy: createdBy.id,
        status: "PENDING",
      },
    });

    void writeAuditLog({
      userId: createdBy.id,
      action: "DEMAND_CREATE",
      entityType: "DemandNotice",
      entityId: created.id,
      afterData: created as unknown as Prisma.InputJsonValue,
    });

    return created;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to create demand",
      500,
    );
  }
}

export async function assignDemand(
  demandId: string,
  inspectorId: string,
  adminUser: RequestUser,
) {
  try {
    const [demand, inspector] = await Promise.all([
      prisma.demandNotice.findUnique({ where: { id: demandId } }),
      prisma.user.findUnique({ where: { id: inspectorId } }),
    ]);
    if (demand === null) {
      throw AppError.notFound("Demand not found");
    }
    if (inspector === null || inspector.role !== "INSPECTOR") {
      throw AppError.badRequest("Invalid inspector");
    }
    if (inspector.districtId !== demand.districtId) {
      throw AppError.badRequest("Inspector must belong to the demand's district");
    }

    const before = { ...demand };
    const updated = await prisma.demandNotice.update({
      where: { id: demandId },
      data: { inspectorId, status: "PENDING" },
    });

    const institution = await prisma.institution.findUnique({
      where: { id: demand.institutionId },
    });

    void notifyInspectorNewDemand(
      inspectorId,
      institution?.name ?? "Institution",
      demand.amountDue.toString(),
    );

    void writeAuditLog({
      userId: adminUser.id,
      action: "DEMAND_ASSIGN",
      entityType: "DemandNotice",
      entityId: demandId,
      beforeData: before as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });

    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to assign demand",
      500,
    );
  }
}
