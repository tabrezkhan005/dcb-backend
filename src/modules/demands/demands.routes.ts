import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import {
  AssignDemandSchema,
  CreateDemandSchema,
  DemandListQuerySchema,
} from "./demands.schema";
import * as demandsService from "./demands.service";

export async function demandsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/demands",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const q = DemandListQuerySchema.parse(request.query);
      const rows = await demandsService.getDemands(user, {
        status: q.status,
        financialYear: q.financialYear,
        districtId: q.districtId,
        search: q.search,
      });
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/demands/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const row = await demandsService.getDemandById(id, user);
      return reply.send(success(row));
    },
  );

  fastify.post(
    "/demands",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = CreateDemandSchema.parse(request.body);
      const created = await demandsService.createDemand(body, user);
      return reply.code(201).send(success(created));
    },
  );

  fastify.patch(
    "/demands/:id/assign",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const body = AssignDemandSchema.parse(request.body);
      const updated = await demandsService.assignDemand(
        id,
        body.inspectorId,
        user,
      );
      return reply.send(success(updated));
    },
  );
}
