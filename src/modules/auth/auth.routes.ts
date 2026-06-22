import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { LoginSchema, PushTokenSchema, RefreshSchema, ChangePasswordSchema } from "./auth.schema";
import * as authService from "./auth.service";

function bearerToken(authorization?: string): string {
  if (authorization === undefined || !authorization.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing bearer token");
  }
  return authorization.slice("Bearer ".length).trim();
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const result = await authService.login(
      body.phone,
      body.password,
      body.deviceId,
      fastify,
    );
    return reply.send(success(result));
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const body = RefreshSchema.parse(request.body);
    const result = await authService.refresh(body.refreshToken, fastify);
    return reply.send(success(result));
  });

  fastify.post(
    "/auth/logout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) {
        throw AppError.unauthorized();
      }
      const token = bearerToken(request.headers.authorization);
      const result = await authService.logout(user.id, token, fastify);
      return reply.send(success(result));
    },
  );

  fastify.patch(
    "/auth/push-token",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) {
        throw AppError.unauthorized();
      }
      const body = PushTokenSchema.parse(request.body);
      const result = await authService.savePushToken(user.id, body.pushToken);
      return reply.send(success(result));
    },
  );

  fastify.patch(
    "/auth/password",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) {
        throw AppError.unauthorized();
      }
      const body = ChangePasswordSchema.parse(request.body);
      const result = await authService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword,
      );
      return reply.send(success(result));
    },
  );
}
