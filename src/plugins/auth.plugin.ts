import crypto from "node:crypto";
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config/env";
import { redisHelpers } from "../config/redis";
import type { RequestUser } from "../types/domain";
import { AppError } from "../utils/errors";

function fingerprintToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function authenticateImpl(
  this: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await request.jwtVerify<RequestUser>();
  const authHeader = request.headers.authorization;
  const bearer =
    authHeader?.startsWith("Bearer ") === true
      ? authHeader.slice("Bearer ".length).trim()
      : undefined;
  if (bearer !== undefined && bearer.length > 0) {
    const fp = fingerprintToken(bearer);
    const blocked = await redisHelpers.exists(`dcb:blacklist:${fp}`);
    if (blocked) {
      throw AppError.unauthorized("Token revoked");
    }
  }
}

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
  });

  fastify.decorate("authenticate", authenticateImpl);
});
