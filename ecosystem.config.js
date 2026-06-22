/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "dcb-backend",
      script: path.join("dist", "server.js"),
      instances: 2,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_file: ".env",
      error_file: path.join("logs", "pm2-error.log"),
      out_file: path.join("logs", "pm2-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "dcb-worker-export",
      script: path.join("dist", "workers", "export.worker.js"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env_file: ".env",
      error_file: path.join("logs", "pm2-export-error.log"),
      out_file: path.join("logs", "pm2-export-out.log"),
    },
    {
      name: "dcb-worker-receipt",
      script: path.join("dist", "workers", "receipt.worker.js"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env_file: ".env",
      error_file: path.join("logs", "pm2-receipt-error.log"),
      out_file: path.join("logs", "pm2-receipt-out.log"),
    },
    {
      name: "dcb-worker-notification",
      script: path.join("dist", "workers", "notification.worker.js"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env_file: ".env",
      error_file: path.join("logs", "pm2-notification-error.log"),
      out_file: path.join("logs", "pm2-notification-out.log"),
    },
  ],
};
