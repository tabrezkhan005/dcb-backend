import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import {
  CreateInstitutionSchema,
  InstitutionListQuerySchema,
  UpdateInstitutionSchema,
} from "./institutions.schema";
import * as institutionsService from "./institutions.service";

export async function institutionsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/institutions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const q = InstitutionListQuerySchema.parse(request.query);
      const rows = await institutionsService.getInstitutions(user, {
        search: q.search,
        isActive:
          q.isActive === "true"
            ? true
            : q.isActive === "false"
              ? false
              : undefined,
      });
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/institutions/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const row = await institutionsService.getInstitutionById(id, user);
      return reply.send(success(row));
    },
  );

  fastify.post(
    "/institutions",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = CreateInstitutionSchema.parse(request.body);
      const created = await institutionsService.createInstitution(body, user);
      return reply.code(201).send(success(created));
    },
  );

  fastify.patch(
    "/institutions/:id",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const body = UpdateInstitutionSchema.parse(request.body);
      const updated = await institutionsService.updateInstitution(id, body, user);
      return reply.send(success(updated));
    },
  );
}
