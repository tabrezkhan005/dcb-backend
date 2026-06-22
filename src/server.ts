import "dotenv/config";
import { buildApp } from "./app";
import { config } from "./config/env";
import { disconnectPrisma } from "./config/database";
import { disconnectRedis } from "./config/redis";
import { closeQueues } from "./config/queue";
import { log } from "./utils/logger";

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.PORT, host: config.HOST });

  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, shutting down`);
    await app.close();
    await closeQueues();
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((err) => {
  log.error("Server failed to start", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
