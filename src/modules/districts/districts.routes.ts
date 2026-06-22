import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { success } from "../../utils/response";
import * as districtsService from "./districts.service";

export async function districtsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/districts",
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      const rows = await districtsService.getAllDistricts();
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/districts/:id/summary",
    {
      preHandler: [requireAuth, requireRole("ADMIN", "CHAIRMAN")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const summary = await districtsService.getDistrictSummary(id);
      return reply.send(success(summary));
    },
  );
}
