import { prisma } from "../../config/database";
import { exportsQueue } from "../../config/queue";
import { demandNoticeWhereForUser } from "../../middleware/scopeQuery";
import { getDCBRegister } from "../reports/reports.service";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

export interface ExportJobPayload {
  type: "dcb" | "collections" | "demands";
  filters: Record<string, unknown>;
  user: Pick<RequestUser, "id" | "role" | "districtId">;
}

export async function requestExport(
  type: ExportJobPayload["type"],
  filters: Record<string, unknown>,
  user: RequestUser,
) {
  try {
    const job = await exportsQueue.add(
      "run-export",
      {
        type,
        filters,
        user: { id: user.id, role: user.role, districtId: user.districtId },
      } satisfies ExportJobPayload,
      {
        removeOnComplete: true,
      },
    );
    if (job.id === undefined) {
      throw new AppError("Failed to create export job", 500);
    }
    return { jobId: String(job.id) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to request export",
      500,
    );
  }
}

export async function getExportStatus(jobId: string) {
  try {
    const job = await exportsQueue.getJob(jobId);
    if (job === undefined) {
      throw AppError.notFound("Export job not found");
    }
    const state = await job.getState();
    if (state === "completed") {
      const rv = job.returnvalue as { downloadUrl?: string } | undefined;
      return {
        status: "ready" as const,
        downloadUrl: rv?.downloadUrl ?? "",
      };
    }
    if (state === "failed") {
      return { status: "failed" as const };
    }
    return { status: "processing" as const };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to read export status",
      500,
    );
  }
}

function asRequestUser(user: ExportJobPayload["user"]): RequestUser {
  return {
    id: user.id,
    name: "export",
    role: user.role,
    districtId: user.districtId,
    deviceId: "",
  };
}

/** CSV rows for collections in scope (used by export worker). */
export async function fetchCollectionsForExport(
  user: ExportJobPayload["user"],
  filters: Record<string, unknown> = {},
) {
  const dateFrom =
    typeof filters.dateFrom === "string" ? new Date(filters.dateFrom) : undefined;
  const dateTo =
    typeof filters.dateTo === "string" ? new Date(filters.dateTo) : undefined;

  const where =
    user.role === "INSPECTOR"
      ? { inspectorId: user.id }
      : user.role === "ACCOUNTS"
        ? { demand: { districtId: user.districtId } }
        : {};

  return prisma.collection.findMany({
    where: {
      ...where,
      ...(dateFrom !== undefined || dateTo !== undefined
        ? {
            submittedAt: {
              ...(dateFrom !== undefined ? { gte: dateFrom } : {}),
              ...(dateTo !== undefined ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    include: {
      demand: {
        include: {
          institution: { select: { name: true } },
          district: { select: { code: true, name: true } },
        },
      },
    },
  });
}

/** Demand rows for export worker. */
export async function fetchDemandsForExport(
  user: ExportJobPayload["user"],
  filters: Record<string, unknown> = {},
) {
  const financialYear =
    typeof filters.financialYear === "string" ? filters.financialYear : undefined;
  const districtId =
    typeof filters.districtId === "string" ? filters.districtId : undefined;

  const scope = demandNoticeWhereForUser(asRequestUser(user));

  return prisma.demandNotice.findMany({
    where: {
      ...scope,
      ...(financialYear !== undefined ? { financialYear } : {}),
      ...(districtId !== undefined &&
      (user.role === "ADMIN" || user.role === "CHAIRMAN")
        ? { districtId }
        : {}),
    },
    orderBy: { dueDate: "asc" },
    include: {
      institution: { select: { name: true, category: true } },
      district: { select: { code: true, name: true } },
      inspector: { select: { name: true, phone: true } },
    },
  });
}

/** DCB register rows for export worker. */
export async function fetchDcbForExport(
  user: ExportJobPayload["user"],
  filters: Record<string, unknown> = {},
) {
  const financialYear =
    typeof filters.financialYear === "string"
      ? filters.financialYear
      : `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`;
  const districtId =
    typeof filters.districtId === "string" ? filters.districtId : undefined;

  return getDCBRegister(asRequestUser(user), {
    financialYear,
    districtId,
  });
}
