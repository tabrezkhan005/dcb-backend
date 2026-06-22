import { prisma } from "../../config/database";
import { redisHelpers } from "../../config/redis";
import { AppError } from "../../utils/errors";

const CACHE_KEY = "dcb:districts:all";
const CACHE_TTL_SEC = 60 * 60;

export async function getAllDistricts() {
  try {
    const cached = await redisHelpers.get(CACHE_KEY);
    if (cached !== null) {
      return JSON.parse(cached) as Awaited<
        ReturnType<typeof prisma.district.findMany>
      >;
    }
    const rows = await prisma.district.findMany({
      orderBy: { name: "asc" },
    });
    await redisHelpers.setex(
      CACHE_KEY,
      CACHE_TTL_SEC,
      JSON.stringify(rows),
    );
    return rows;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load districts",
      500,
    );
  }
}

export async function getDistrictById(id: string) {
  try {
    const d = await prisma.district.findUnique({ where: { id } });
    if (d === null) {
      throw AppError.notFound("District not found");
    }
    return d;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load district",
      500,
    );
  }
}

export async function getDistrictSummary(id: string) {
  try {
    const district = await prisma.district.findUnique({ where: { id } });
    if (district === null) {
      throw AppError.notFound("District not found");
    }

    const [demandAgg, collectionAgg, inspectorCount] = await Promise.all([
      prisma.demandNotice.aggregate({
        where: { districtId: id },
        _sum: { amountDue: true },
        _count: { _all: true },
      }),
      prisma.collection.aggregate({
        where: {
          status: "ACCEPTED",
          demand: { districtId: id },
        },
        _sum: { amountCollected: true },
        _count: { _all: true },
      }),
      prisma.user.count({
        where: { districtId: id, role: "INSPECTOR", isActive: true },
      }),
    ]);

    return {
      district,
      stats: {
        totalDemands: demandAgg._count._all,
        totalDemanded: demandAgg._sum.amountDue?.toString() ?? "0",
        totalCollections: collectionAgg._count._all,
        totalCollected: collectionAgg._sum.amountCollected?.toString() ?? "0",
        activeInspectors: inspectorCount,
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load summary",
      500,
    );
  }
}
