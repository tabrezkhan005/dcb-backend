import pino, { type Logger } from "pino";

const nodeEnv = process.env.NODE_ENV ?? "development";

const base = {
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger: Logger = pino({
  level: nodeEnv === "development" ? "debug" : "info",
  ...base,
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export const log = {
  info(msg: string, context?: Record<string, unknown>) {
    if (context) logger.info(context, msg);
    else logger.info(msg);
  },
  error(msg: string, context?: Record<string, unknown>) {
    if (context) logger.error(context, msg);
    else logger.error(msg);
  },
  warn(msg: string, context?: Record<string, unknown>) {
    if (context) logger.warn(context, msg);
    else logger.warn(msg);
  },
  debug(msg: string, context?: Record<string, unknown>) {
    if (context) logger.debug(context, msg);
    else logger.debug(msg);
  },
};
