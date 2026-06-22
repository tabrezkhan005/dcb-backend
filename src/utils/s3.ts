import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../config/env";

let client: S3Client | null = null;

/** Shared S3 client — uses EC2 instance role when access keys are omitted. */
export function getS3Client(): S3Client {
  if (client === null) {
    client = new S3Client({
      region: config.AWS_REGION,
      ...(config.AWS_ACCESS_KEY_ID !== undefined &&
      config.AWS_ACCESS_KEY_ID.length > 0 &&
      config.AWS_SECRET_ACCESS_KEY !== undefined &&
      config.AWS_SECRET_ACCESS_KEY.length > 0
        ? {
            credentials: {
              accessKeyId: config.AWS_ACCESS_KEY_ID,
              secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return client;
}
