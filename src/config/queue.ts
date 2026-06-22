import { Queue } from "bullmq";
import { createBullRedis } from "./redis";

export const QUEUE_NAMES = {
  NOTIFICATIONS: "dcb-notifications",
  RECEIPTS: "dcb-receipts",
  EXPORTS: "dcb-exports",
} as const;

const connection = createBullRedis();

const defaultJobOptions = {
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection,
  defaultJobOptions,
});

export const receiptsQueue = new Queue(QUEUE_NAMES.RECEIPTS, {
  connection,
  defaultJobOptions,
});

export const exportsQueue = new Queue(QUEUE_NAMES.EXPORTS, {
  connection,
  defaultJobOptions,
});

export const queueConnection = connection;

export async function closeQueues(): Promise<void> {
  await Promise.all([
    notificationsQueue.close(),
    receiptsQueue.close(),
    exportsQueue.close(),
  ]);
  await connection.quit();
}
