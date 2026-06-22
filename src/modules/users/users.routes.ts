import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import {
  CreateUserSchema,
  TransferInspectorSchema,
  UpdateUserSchema,
  UserListQuerySchema,
} from "./users.schema";
import * as usersService from "./users.service";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/audit-logs",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (_request, reply) => {
      const rows = await usersService.listAuditLogs();
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/users",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const q = UserListQuerySchema.parse(request.query);
      const rows = await usersService.getUsers({
        role: q.role,
        districtId: q.districtId,
        isActive:
          q.isActive === "true"
            ? true
            : q.isActive === "false"
              ? false
              : undefined,
        search: q.search,
      });
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/users/:id",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const row = await usersService.getUserById(id);
      return reply.send(success(row));
    },
  );

  fastify.get(
    "/users/:id/activity",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rows = await usersService.getUserActivity(id);
      return reply.send(success(rows));
    },
  );

  fastify.post(
    "/users",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = CreateUserSchema.parse(request.body);
      const created = await usersService.createUser(body, user);
      return reply.code(201).send(success(created));
    },
  );

  fastify.patch(
    "/users/:id",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const body = UpdateUserSchema.parse(request.body);
      const updated = await usersService.updateUser(id, body, user);
      return reply.send(success(updated));
    },
  );

  fastify.patch(
    "/users/:id/transfer",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const body = TransferInspectorSchema.parse(request.body);
      const updated = await usersService.transferInspector(
        id,
        body.newDistrictId,
        body.notes,
        user,
      );
      return reply.send(success(updated));
    },
  );

  fastify.patch(
    "/users/:id/deactivate",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const updated = await usersService.deactivateUser(id, user);
      return reply.send(success(updated));
    },
  );

  fastify.patch(
    "/users/:id/reset-device",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const updated = await usersService.resetUserDevice(id, user);
      return reply.send(success(updated));
    },
  );
}
