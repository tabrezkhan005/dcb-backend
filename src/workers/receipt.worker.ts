import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import { prisma } from "../config/database";
import { config } from "../config/env";
import { QUEUE_NAMES } from "../config/queue";
import { createBullRedis } from "../config/redis";
import { log } from "../utils/logger";
import { getS3Client } from "../utils/s3";

interface ReceiptJobData {
  collectionId: string;
}

const connection = createBullRedis();

const worker = new Worker<ReceiptJobData>(
  QUEUE_NAMES.RECEIPTS,
  async (job) => {
    const { collectionId } = job.data;
    if (config.S3_RECEIPTS_BUCKET.length === 0) {
      log.warn("S3_RECEIPTS_BUCKET not configured; skipping receipt upload");
      return;
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        demand: {
          include: { institution: true, district: true },
        },
      },
    });
    if (collection === null || collection.receiptNumber === null) {
      return;
    }

    const body = [
      `Receipt: ${collection.receiptNumber}`,
      `Amount: ${collection.amountCollected.toString()}`,
      `Institution: ${collection.demand.institution.name}`,
      `District: ${collection.demand.district.name} (${collection.demand.district.code})`,
      `Submitted: ${collection.submittedAt.toISOString()}`,
    ].join("\n");

    const key = `receipts/${collection.demand.district.code}/${collection.receiptNumber}.txt`;
    const s3 = getS3Client();

    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_RECEIPTS_BUCKET,
        Key: key,
        Body: Buffer.from(body, "utf8"),
        ContentType: "text/plain",
      }),
    );

    await prisma.collection.update({
      where: { id: collectionId },
      data: { receiptS3Key: key },
    });
  },
  { connection },
);

worker.on("failed", (job, err) => {
  log.error("Receipt job failed", {
    jobId: job?.id,
    message: err instanceof Error ? err.message : String(err),
  });
});

log.info("Receipt worker started", { queue: QUEUE_NAMES.RECEIPTS });
