import type { Role } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { error } from "../utils/response";

export function requireRole(...roles: Role[]) {
  return async function requireRoleHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;
    if (user === undefined) {
      await reply.code(401).send(error("Unauthorized"));
      return;
    }
    if (!roles.includes(user.role)) {
      await reply.code(403).send(error("Forbidden", "FORBIDDEN"));
      return;
    }
  };
}
