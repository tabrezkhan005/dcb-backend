import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { redisHelpers } from "../../config/redis";
import {
  demandNoticeWhereForUser,
  institutionWhereForUser,
} from "../../middleware/scopeQuery";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";
import crypto from "node:crypto";

function cacheKey(parts: string[]): string {
  return `dcb:reports:${parts.join(":")}`;
}

function hashPayload(obj: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex")
    .slice(0, 32);
}

export async function getDCBRegister(
  user: RequestUser,
  filters: {
    districtId?: string;
    financialYear: string;
    institutionId?: string;
  },
) {
  try {
    const cachePayload = { user: user.id, role: user.role, filters };
    const key = cacheKey(["dcb", hashPayload(cachePayload)]);
    const cached = await redisHelpers.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as unknown[];
    }

    const instWhere: Prisma.InstitutionWhereInput =
      user.role === "INSPECTOR"
        ? {
            demandNotices: {
              some: {
                inspectorId: user.id,
                financialYear: filters.financialYear,
              },
            },
          }
        : {
            ...institutionWhereForUser(user),
            ...(filters.institutionId !== undefined
              ? { id: filters.institutionId }
              : {}),
            ...(filters.districtId !== undefined &&
            (user.role === "ADMIN" || user.role === "CHAIRMAN")
              ? { districtId: filters.districtId }
              : {}),
          };

    const institutions = await prisma.institution.findMany({
      where: instWhere,
      include: {
        district: { select: { id: true, name: true, code: true } },
        demandNotices: {
          where: {
            financialYear: filters.financialYear,
            ...(user.role === "INSPECTOR" ? { inspectorId: user.id } : {}),
            ...(user.role === "ACCOUNTS"
              ? { districtId: user.districtId }
              : {}),
            ...(filters.districtId !== undefined &&
            (user.role === "ADMIN" || user.role === "CHAIRMAN")
              ? { districtId: filters.districtId }
              : {}),
          },
          include: {
            collections: { where: { status: "ACCEPTED" } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const rows = institutions.map((inst) => {
      let demandAmount = new Prisma.Decimal(0);
      let totalCollected = new Prisma.Decimal(0);
      let worst: "PENDING" | "PARTIAL" | "COLLECTED" | "OVERDUE" = "PENDING";

      for (const d of inst.demandNotices) {
        demandAmount = demandAmount.plus(d.amountDue);
        for (const c of d.collections) {
          totalCollected = totalCollected.plus(c.amountCollected);
        }
        if (d.status === "OVERDUE") worst = "OVERDUE";
        else if (d.status === "PARTIAL" && worst !== "OVERDUE") {
          worst = "PARTIAL";
        } else if (d.status === "COLLECTED" && worst === "PENDING") {
          worst = "COLLECTED";
        }
      }

      const balance = demandAmount.minus(totalCollected);
      let status = worst;
      if (balance.lessThanOrEqualTo(0) && demandAmount.greaterThan(0)) {
        status = "COLLECTED";
      } else if (totalCollected.greaterThan(0) && balance.greaterThan(0)) {
        status = "PARTIAL";
      }

      return {
        institutionId: inst.id,
        institutionName: inst.name,
        district: inst.district,
        demandAmount: demandAmount.toString(),
        totalCollected: totalCollected.toString(),
        balance: balance.toString(),
        status,
      };
    });

    await redisHelpers.setex(key, 300, JSON.stringify(rows));
    return rows;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to build DCB register",
      500,
    );
  }
}

export async function getSummary(user: RequestUser) {
  try {
    const key = cacheKey(["summary", user.id, user.role]);
    const cached = await redisHelpers.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const demandWhere: Prisma.DemandNoticeWhereInput =
      demandNoticeWhereForUser(user);
    const collectionWhere: Prisma.CollectionWhereInput = {
      status: "ACCEPTED",
      ...(user.role === "INSPECTOR"
        ? { inspectorId: user.id }
        : user.role === "ACCOUNTS"
          ? { demand: { districtId: user.districtId } }
          : {}),
    };

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [
      demandAgg,
      collectedAgg,
      pendingDemands,
      inspectors,
      todayAgg,
    ] = await Promise.all([
      prisma.demandNotice.aggregate({
        where: demandWhere,
        _sum: { amountDue: true },
      }),
      prisma.collection.aggregate({
        where: collectionWhere,
        _sum: { amountCollected: true },
      }),
      prisma.demandNotice.count({
        where: { ...demandWhere, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      }),
      prisma.user.count({
        where: {
          role: "INSPECTOR",
          isActive: true,
          ...(user.role === "ACCOUNTS"
            ? { districtId: user.districtId }
            : user.role === "INSPECTOR"
              ? { id: user.id }
              : {}),
        },
      }),
      prisma.collection.aggregate({
        where: {
          ...collectionWhere,
          submittedAt: { gte: startOfDay },
        },
        _sum: { amountCollected: true },
      }),
    ]);

    const districtListWhere: Prisma.DistrictWhereInput =
      user.role === "INSPECTOR" || user.role === "ACCOUNTS"
        ? { id: user.districtId }
        : {};

    const districtsList = await prisma.district.findMany({
      where: districtListWhere,
      orderBy: { name: "asc" },
    });

    const collectionsByDistrict = await Promise.all(
      districtsList.map(async (d) => {
        const [demanded, collected] = await Promise.all([
          prisma.demandNotice.aggregate({
            where: { ...demandWhere, districtId: d.id },
            _sum: { amountDue: true },
          }),
          prisma.collection.aggregate({
            where: {
              status: "ACCEPTED",
              demand: {
                ...demandWhere,
                districtId: d.id,
              },
            },
            _sum: { amountCollected: true },
          }),
        ]);
        return {
          districtId: d.id,
          districtName: d.name,
          demanded: demanded._sum.amountDue?.toString() ?? "0",
          collected: collected._sum.amountCollected?.toString() ?? "0",
        };
      }),
    );

    const summary = {
      totalDemanded: demandAgg._sum.amountDue?.toString() ?? "0",
      totalCollected: collectedAgg._sum.amountCollected?.toString() ?? "0",
      totalPending: pendingDemands,
      activeInspectors: inspectors,
      collectionsByDistrict,
      todayCollection: todayAgg._sum.amountCollected?.toString() ?? "0",
    };

    await redisHelpers.setex(key, 600, JSON.stringify(summary));
    return summary;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to build summary",
      500,
    );
  }
}

export async function getAnalytics(
  user: RequestUser,
  filters: { financialYear: string },
) {
  try {
    const key = cacheKey(["analytics", user.id, user.role, filters.financialYear]);
    const cached = await redisHelpers.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const demandWhere: Prisma.DemandNoticeWhereInput = {
      financialYear: filters.financialYear,
      ...demandNoticeWhereForUser(user),
    };

    const collections = await prisma.collection.findMany({
      where: {
        status: "ACCEPTED",
        demand: demandWhere,
      },
      include: {
        demand: { select: { districtId: true, amountDue: true, financialYear: true } },
      },
    });

    const monthly = new Map<
      string,
      { collected: Prisma.Decimal; demanded: Prisma.Decimal }
    >();
    const paymentBreak: Record<
      string,
      { count: number; amount: Prisma.Decimal }
    > = {
      CASH: { count: 0, amount: new Prisma.Decimal(0) },
      CHEQUE: { count: 0, amount: new Prisma.Decimal(0) },
      UPI: { count: 0, amount: new Prisma.Decimal(0) },
      DD: { count: 0, amount: new Prisma.Decimal(0) },
    };

    const inspectorIds = [...new Set(collections.map((c) => c.inspectorId))];
    const inspectors = await prisma.user.findMany({
      where: { id: { in: inspectorIds } },
      select: { id: true, name: true },
    });
    const inspectorName = new Map(inspectors.map((i) => [i.id, i.name]));
    const inspectorTotals = new Map<
      string,
      { name: string; amount: Prisma.Decimal }
    >();

    for (const c of collections) {
      const monthKey = `${c.submittedAt.getUTCFullYear()}-${String(c.submittedAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const bucket = monthly.get(monthKey) ?? {
        collected: new Prisma.Decimal(0),
        demanded: new Prisma.Decimal(0),
      };
      bucket.collected = bucket.collected.plus(c.amountCollected);
      monthly.set(monthKey, bucket);

      const pm = c.paymentMode;
      const pb = paymentBreak[pm];
      if (pb !== undefined) {
        pb.count += 1;
        pb.amount = pb.amount.plus(c.amountCollected);
      }

      const prev = inspectorTotals.get(c.inspectorId) ?? {
        name: inspectorName.get(c.inspectorId) ?? "Inspector",
        amount: new Prisma.Decimal(0),
      };
      prev.amount = prev.amount.plus(c.amountCollected);
      inspectorTotals.set(c.inspectorId, prev);
    }

    const demands = await prisma.demandNotice.findMany({
      where: demandWhere,
      select: { amountDue: true, dueDate: true, institutionId: true, status: true },
    });
    for (const d of demands) {
      const monthKey = `${d.dueDate.getUTCFullYear()}-${String(d.dueDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const bucket = monthly.get(monthKey) ?? {
        collected: new Prisma.Decimal(0),
        demanded: new Prisma.Decimal(0),
      };
      bucket.demanded = bucket.demanded.plus(d.amountDue);
      monthly.set(monthKey, bucket);
    }

    const monthlyTrend = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        collected: v.collected.toString(),
        demanded: v.demanded.toString(),
      }));

    const paymentModeBreakdown = Object.fromEntries(
      Object.entries(paymentBreak).map(([k, v]) => [
        k,
        { count: v.count, amount: v.amount.toString() },
      ]),
    );

    const topInspectors = [...inspectorTotals.entries()]
      .map(([id, v]) => ({ inspectorId: id, name: v.name, amount: v.amount.toString() }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);

    const districts = await prisma.district.findMany({
      where:
        user.role === "INSPECTOR" || user.role === "ACCOUNTS"
          ? { id: user.districtId }
          : {},
      orderBy: { name: "asc" },
    });
    const districtComparison = await Promise.all(
      districts.map(async (dist) => {
        const [demanded, collected] = await Promise.all([
          prisma.demandNotice.aggregate({
            where: {
              ...demandWhere,
              districtId: dist.id,
            },
            _sum: { amountDue: true },
          }),
          prisma.collection.aggregate({
            where: {
              status: "ACCEPTED",
              demand: {
                ...demandWhere,
                districtId: dist.id,
              },
            },
            _sum: { amountCollected: true },
          }),
        ]);
        const dAmt = demanded._sum.amountDue ?? new Prisma.Decimal(0);
        const cAmt = collected._sum.amountCollected ?? new Prisma.Decimal(0);
        const pct = dAmt.equals(0)
          ? 0
          : Number(cAmt.div(dAmt).mul(100).toFixed(2));
        return {
          districtId: dist.id,
          districtName: dist.name,
          code: dist.code,
          demanded: dAmt.toString(),
          collected: cAmt.toString(),
          recoveryPercent: pct,
        };
      }),
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const overdueDemands = await prisma.demandNotice.findMany({
      where: {
        ...demandWhere,
        dueDate: { lt: today },
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      include: {
        institution: { select: { id: true, name: true } },
        collections: { where: { status: "ACCEPTED" } },
      },
    });

    const overdueInstitutions = overdueDemands.map((d) => {
      let paid = new Prisma.Decimal(0);
      for (const c of d.collections) {
        paid = paid.plus(c.amountCollected);
      }
      const balance = d.amountDue.minus(paid);
      const days = Math.floor(
        (today.getTime() - d.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        demandId: d.id,
        institutionName: d.institution.name,
        balance: balance.toString(),
        daysOverdue: days,
      };
    });

    const payload = {
      monthlyTrend,
      paymentModeBreakdown,
      topInspectors,
      districtComparison,
      overdueInstitutions,
    };

    await redisHelpers.setex(key, 600, JSON.stringify(payload));
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to build analytics",
      500,
    );
  }
}

export async function getInspectorReport(
  inspectorId: string,
  filters: { financialYear?: string },
) {
  try {
    const inspector = await prisma.user.findUnique({
      where: { id: inspectorId },
      select: { id: true, name: true, role: true, district: true },
    });
    if (inspector === null || inspector.role !== "INSPECTOR") {
      throw AppError.notFound("Inspector not found");
    }

    const demandWhere: Prisma.DemandNoticeWhereInput = {
      inspectorId,
      ...(filters.financialYear !== undefined
        ? { financialYear: filters.financialYear }
        : {}),
    };

    const [demands, collections] = await Promise.all([
      prisma.demandNotice.findMany({
        where: demandWhere,
        include: {
          institution: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.collection.findMany({
        where: {
          inspectorId,
          status: "ACCEPTED",
          ...(filters.financialYear !== undefined
            ? {
                demand: { financialYear: filters.financialYear },
              }
            : {}),
        },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          receiptNumber: true,
          amountCollected: true,
          submittedAt: true,
          paymentMode: true,
        },
      }),
    ]);

    let totalDemanded = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    for (const d of demands) {
      totalDemanded = totalDemanded.plus(d.amountDue);
    }
    for (const c of collections) {
      totalCollected = totalCollected.plus(c.amountCollected);
    }

    return {
      inspector,
      summary: {
        totalDemanded: totalDemanded.toString(),
        totalCollected: totalCollected.toString(),
        demandCount: demands.length,
        receiptCount: collections.filter((c) => c.receiptNumber !== null).length,
      },
      demands,
      receipts: collections,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to build inspector report",
      500,
    );
  }
}
