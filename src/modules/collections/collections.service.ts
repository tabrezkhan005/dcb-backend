import type { CollectionStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../../config/database";
import { receiptsQueue } from "../../config/queue";
import { writeAuditLog } from "../../middleware/auditLog";
import { collectionWhereForUser } from "../../middleware/scopeQuery";
import { generateReceiptNumber } from "../../utils/receiptNumber";
import { getS3Client } from "../../utils/s3";
import { config } from "../../config/env";
import {
  notifyAccountsNewCollection,
  notifyInspectorCollectionAccepted,
  notifyInspectorCollectionQueried,
} from "../notifications/notification.service";
import { updateDemandStatus } from "../demands/demands.service";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

function toDecimal(v: string | number) {
  return new Prisma.Decimal(v);
}

export async function submitCollection(
  data: {
    demandId: string;
    amountCollected: string | number;
    paymentMode: Prisma.CollectionCreateInput["paymentMode"];
    referenceNo?: string | null;
    idempotencyKey: string;
  },
  inspector: RequestUser,
) {
  try {
    const existing = await prisma.collection.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: {
        demand: { include: { institution: true } },
        inspector: { select: { id: true, name: true } },
      },
    });
    if (existing !== null) {
      return existing;
    }

    const demand = await prisma.demandNotice.findUnique({
      where: { id: data.demandId },
      include: {
        collections: { where: { status: "ACCEPTED" } },
        institution: true,
        district: true,
      },
    });

    if (demand === null) {
      throw AppError.notFound("Demand not found");
    }
    if (demand.inspectorId !== inspector.id) {
      throw AppError.forbidden("This demand is not assigned to you");
    }

    let collected = new Prisma.Decimal(0);
    for (const c of demand.collections) {
      collected = collected.plus(c.amountCollected);
    }
    const remaining = demand.amountDue.minus(collected);
    const amount = toDecimal(data.amountCollected);
    if (amount.greaterThan(remaining)) {
      throw AppError.badRequest(
        "Collection amount exceeds remaining demand balance",
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      return tx.collection.create({
        data: {
          demandId: data.demandId,
          inspectorId: inspector.id,
          amountCollected: amount,
          paymentMode: data.paymentMode,
          referenceNo: data.referenceNo ?? null,
          status: "SUBMITTED",
          idempotencyKey: data.idempotencyKey,
        },
        include: {
          demand: { include: { institution: true, district: true } },
        },
      });
    });

    void notifyAccountsNewCollection(
      demand.districtId,
      created.id,
      demand.institution.name,
      amount.toString(),
    );

    void writeAuditLog({
      userId: inspector.id,
      action: "COLLECTION_SUBMIT",
      entityType: "Collection",
      entityId: created.id,
      afterData: created as unknown as Prisma.InputJsonValue,
      deviceId: inspector.deviceId,
    });

    return created;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const row = await prisma.collection.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (row !== null) {
        return row;
      }
    }
    throw new AppError(
      err instanceof Error ? err.message : "Failed to submit collection",
      500,
    );
  }
}

export async function getCollections(
  user: RequestUser,
  filters: {
    status?: CollectionStatus;
    districtId?: string;
    inspectorId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
) {
  try {
    const scope = collectionWhereForUser(user);
    const where: Prisma.CollectionWhereInput = {
      ...scope,
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(filters.inspectorId !== undefined &&
      (user.role === "ADMIN" || user.role === "CHAIRMAN")
        ? { inspectorId: filters.inspectorId }
        : {}),
      ...(filters.districtId !== undefined &&
      (user.role === "ADMIN" || user.role === "CHAIRMAN")
        ? { demand: { districtId: filters.districtId } }
        : {}),
      ...(filters.dateFrom !== undefined || filters.dateTo !== undefined
        ? {
            submittedAt: {
              ...(filters.dateFrom !== undefined
                ? { gte: filters.dateFrom }
                : {}),
              ...(filters.dateTo !== undefined ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };

    return await prisma.collection.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: {
        demand: {
          include: {
            institution: { select: { id: true, name: true } },
            district: { select: { id: true, name: true, code: true } },
          },
        },
        inspector: { select: { id: true, name: true } },
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to list collections",
      500,
    );
  }
}

export async function getCollectionById(id: string, user: RequestUser) {
  try {
    const row = await prisma.collection.findUnique({
      where: { id },
      include: {
        demand: {
          include: {
            institution: true,
            district: true,
          },
        },
        inspector: { select: { id: true, name: true, phone: true } },
        accountsUser: { select: { id: true, name: true } },
      },
    });
    if (row === null) {
      throw AppError.notFound("Collection not found");
    }
    if (user.role === "INSPECTOR" && row.inspectorId !== user.id) {
      throw AppError.forbidden();
    }
    if (
      user.role === "ACCOUNTS" &&
      row.demand.districtId !== user.districtId
    ) {
      throw AppError.forbidden();
    }
    return row;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to load collection",
      500,
    );
  }
}

export async function acceptCollection(
  collectionId: string,
  accountsUser: RequestUser,
) {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        demand: { include: { district: true, institution: true } },
      },
    });
    if (collection === null) {
      throw AppError.notFound("Collection not found");
    }
    if (collection.status !== "SUBMITTED") {
      throw AppError.badRequest("Collection is not awaiting verification");
    }
    if (collection.demand.districtId !== accountsUser.districtId) {
      throw AppError.forbidden("Collection is outside your district");
    }

    const districtCode = collection.demand.district.code;
    const year = collection.submittedAt.getFullYear();

    const updated = await prisma.$transaction(
      async (tx) => {
        const receiptNumber = await generateReceiptNumber(
          tx,
          districtCode,
          year,
        );

        const next = await tx.collection.update({
          where: { id: collectionId },
          data: {
            status: "ACCEPTED",
            accountsUserId: accountsUser.id,
            reviewedAt: new Date(),
            receiptNumber,
          },
          include: {
            demand: { include: { institution: true, district: true } },
            inspector: { select: { id: true, name: true } },
          },
        });

        await updateDemandStatus(collection.demandId, tx);
        return next;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    void receiptsQueue.add("generate-receipt", {
      collectionId: updated.id,
    });

    void notifyInspectorCollectionAccepted(
      updated.inspectorId,
      updated.receiptNumber ?? "",
      updated.amountCollected.toString(),
    );

    void writeAuditLog({
      userId: accountsUser.id,
      action: "COLLECTION_ACCEPT",
      entityType: "Collection",
      entityId: collectionId,
      beforeData: collection as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });

    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to accept collection",
      500,
    );
  }
}

export async function queryCollection(
  collectionId: string,
  note: string,
  accountsUser: RequestUser,
) {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        demand: { include: { institution: true } },
      },
    });
    if (collection === null) {
      throw AppError.notFound("Collection not found");
    }
    if (collection.status !== "SUBMITTED") {
      throw AppError.badRequest("Collection is not awaiting verification");
    }
    if (collection.demand.districtId !== accountsUser.districtId) {
      throw AppError.forbidden("Collection is outside your district");
    }

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        status: "QUERIED",
        accountsNote: note,
        accountsUserId: accountsUser.id,
        reviewedAt: new Date(),
      },
      include: {
        demand: { include: { institution: true } },
      },
    });

    void notifyInspectorCollectionQueried(
      collection.inspectorId,
      note,
      collection.demand.institution.name,
    );

    void writeAuditLog({
      userId: accountsUser.id,
      action: "COLLECTION_QUERY",
      entityType: "Collection",
      entityId: collectionId,
      beforeData: collection as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue,
    });

    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to query collection",
      500,
    );
  }
}

export async function getReceiptDownloadUrl(
  collectionId: string,
  user: RequestUser,
): Promise<{ downloadUrl: string; receiptNumber: string | null }> {
  const row = await getCollectionById(collectionId, user);
  if (
    row.receiptS3Key === null ||
    row.receiptS3Key === undefined ||
    row.receiptS3Key.length === 0
  ) {
    throw AppError.notFound("Receipt file is not available yet");
  }
  if (config.S3_RECEIPTS_BUCKET.length === 0) {
    throw new AppError("Receipt storage is not configured", 503);
  }

  const s3 = getS3Client();
  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.S3_RECEIPTS_BUCKET,
      Key: row.receiptS3Key,
    }),
    { expiresIn: 3600 },
  );

  return { downloadUrl, receiptNumber: row.receiptNumber };
}
