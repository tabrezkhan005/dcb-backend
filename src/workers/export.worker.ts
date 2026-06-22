import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Worker } from "bullmq";
import { config } from "../config/env";
import { QUEUE_NAMES } from "../config/queue";
import { createBullRedis } from "../config/redis";
import { log } from "../utils/logger";
import { getS3Client } from "../utils/s3";
import type { ExportJobPayload } from "../modules/exports/exports.service";
import {
  fetchCollectionsForExport,
  fetchDcbForExport,
  fetchDemandsForExport,
} from "../modules/exports/exports.service";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCollectionsCsv(
  rows: Awaited<ReturnType<typeof fetchCollectionsForExport>>,
): string {
  const header = [
    "collectionId",
    "submittedAt",
    "status",
    "amount",
    "paymentMode",
    "receiptNumber",
    "institution",
    "districtCode",
    "districtName",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      r.submittedAt.toISOString(),
      r.status,
      r.amountCollected.toString(),
      r.paymentMode,
      r.receiptNumber ?? "",
      csvEscape(r.demand.institution.name),
      r.demand.district.code,
      csvEscape(r.demand.district.name),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function buildDemandsCsv(
  rows: Awaited<ReturnType<typeof fetchDemandsForExport>>,
): string {
  const header = [
    "demandId",
    "financialYear",
    "dueDate",
    "status",
    "amountDue",
    "institution",
    "category",
    "districtCode",
    "inspectorName",
    "inspectorPhone",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      r.financialYear,
      r.dueDate.toISOString().slice(0, 10),
      r.status,
      r.amountDue.toString(),
      csvEscape(r.institution.name),
      csvEscape(r.institution.category),
      r.district.code,
      csvEscape(r.inspector?.name ?? ""),
      r.inspector?.phone ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function buildDcbCsv(rows: Awaited<ReturnType<typeof fetchDcbForExport>>): string {
  const header = [
    "institutionId",
    "institutionName",
    "districtCode",
    "districtName",
    "demandAmount",
    "totalCollected",
    "balance",
    "status",
  ].join(",");
  const lines = rows.map((r) => {
    const row = r as {
      institutionId: string;
      institutionName: string;
      district: { code: string; name: string };
      demandAmount: string;
      totalCollected: string;
      balance: string;
      status: string;
    };
    return [
      row.institutionId,
      csvEscape(row.institutionName),
      row.district.code,
      csvEscape(row.district.name),
      row.demandAmount,
      row.totalCollected,
      row.balance,
      row.status,
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

async function runExport(jobData: ExportJobPayload): Promise<string> {
  if (config.S3_EXPORTS_BUCKET.length === 0) {
    throw new Error("S3_EXPORTS_BUCKET is not configured");
  }

  let csv: string;
  let suffix: string;

  switch (jobData.type) {
    case "collections": {
      const rows = await fetchCollectionsForExport(jobData.user, jobData.filters);
      csv = buildCollectionsCsv(rows);
      suffix = "collections";
      break;
    }
    case "demands": {
      const rows = await fetchDemandsForExport(jobData.user, jobData.filters);
      csv = buildDemandsCsv(rows);
      suffix = "demands";
      break;
    }
    case "dcb":
    default: {
      const rows = await fetchDcbForExport(jobData.user, jobData.filters);
      csv = buildDcbCsv(rows);
      suffix = "dcb";
      break;
    }
  }

  const key = `exports/${jobData.user.id}/${Date.now()}-${suffix}.csv`;
  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_EXPORTS_BUCKET,
      Key: key,
      Body: Buffer.from(csv, "utf8"),
      ContentType: "text/csv",
    }),
  );

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.S3_EXPORTS_BUCKET,
      Key: key,
    }),
    { expiresIn: 3600 },
  );
}

const connection = createBullRedis();

const worker = new Worker<ExportJobPayload>(
  QUEUE_NAMES.EXPORTS,
  async (job) => {
    const downloadUrl = await runExport(job.data);
    return { downloadUrl };
  },
  { connection },
);

worker.on("failed", (job, err) => {
  log.error("Export job failed", {
    jobId: job?.id,
    message: err instanceof Error ? err.message : String(err),
  });
});

worker.on("completed", (job) => {
  log.info("Export job completed", { jobId: job.id });
});

log.info("Export worker started", { queue: QUEUE_NAMES.EXPORTS });
