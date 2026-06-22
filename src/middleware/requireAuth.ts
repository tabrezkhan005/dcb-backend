import type { FastifyReply, FastifyRequest } from "fastify";
import { error } from "../utils/response";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.server.authenticate(request, reply);
  } catch {
    await reply.code(401).send(error("Unauthorized"));
    return;
  }
}
