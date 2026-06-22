import "fastify";
import type { RequestUser } from "./domain";

declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
  }

  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: RequestUser;
    user: RequestUser;
  }
}
