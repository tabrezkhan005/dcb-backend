import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { log } from "../utils/logger";

export interface WriteAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Prisma.InputJsonValue | null;
  afterData?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  deviceId?: string | null;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeData: params.beforeData ?? undefined,
        afterData: params.afterData ?? undefined,
        ipAddress: params.ipAddress ?? null,
        deviceId: params.deviceId ?? null,
      },
    });
  } catch (err) {
    log.error("writeAuditLog failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
