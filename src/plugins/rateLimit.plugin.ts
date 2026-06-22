import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";

function tryBearerUserId(authHeader?: string): string | undefined {
  if (authHeader === undefined || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length < 2 || parts[1] === undefined) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : undefined;
  } catch {
    return undefined;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    global: true,
    timeWindow: "1 minute",
    max: (req: FastifyRequest) => {
      const path = (req.url.split("?")[0] ?? req.url).toLowerCase();
      if (path.includes("/auth/login") || path.includes("/auth/refresh")) {
        return 5;
      }
      return 200;
    },
    keyGenerator: (req) => {
      const path = (req.url.split("?")[0] ?? req.url).toLowerCase();
      if (path.includes("/auth/login") || path.includes("/auth/refresh")) {
        return `dcb:ratelimit:ip:${req.ip}`;
      }
      const fromHeader = tryBearerUserId(req.headers.authorization);
      if (fromHeader !== undefined) {
        return `dcb:ratelimit:user:${fromHeader}`;
      }
      return `dcb:ratelimit:ip:${req.ip}`;
    },
  });
});
