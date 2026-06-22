import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../src/config/env";

async function main(): Promise<void> {
  if (config.S3_EXPORTS_BUCKET.length === 0) {
    throw new Error("S3_EXPORTS_BUCKET is not set");
  }

  const s3 = new S3Client({
    region: config.AWS_REGION,
    ...(config.AWS_ACCESS_KEY_ID &&
    config.AWS_ACCESS_KEY_ID.length > 0 &&
    config.AWS_SECRET_ACCESS_KEY &&
    config.AWS_SECRET_ACCESS_KEY.length > 0
      ? {
          credentials: {
            accessKeyId: config.AWS_ACCESS_KEY_ID,
            secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  const key = `health-check/test-${Date.now()}.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_EXPORTS_BUCKET,
      Key: key,
      Body: "DCB S3 connectivity test",
      ContentType: "text/plain",
    }),
  );

  console.log(`OK uploaded s3://${config.S3_EXPORTS_BUCKET}/${key} (${config.AWS_REGION})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
