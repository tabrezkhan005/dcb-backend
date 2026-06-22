import { Worker } from "bullmq";
import { QUEUE_NAMES } from "../config/queue";
import { createBullRedis } from "../config/redis";
import { sendPushNotification } from "../modules/notifications/push.service";
import { log } from "../utils/logger";

export interface NotificationJobData {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

const connection = createBullRedis();

const worker = new Worker<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job) => {
    const { tokens, title, body, data } = job.data;
    await sendPushNotification(tokens, title, body, data);
  },
  { connection },
);

worker.on("failed", (job, err) => {
  log.error("Notification job failed", {
    jobId: job?.id,
    message: err instanceof Error ? err.message : String(err),
  });
});

log.info("Notification worker started", { queue: QUEUE_NAMES.NOTIFICATIONS });
