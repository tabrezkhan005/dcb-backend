import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import { ExportRequestSchema } from "./exports.schema";
import * as exportsService from "./exports.service";

export async function exportsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/exports",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = ExportRequestSchema.parse(request.body);
      const result = await exportsService.requestExport(
        body.type,
        body.filters,
        user,
      );
      return reply.code(202).send(success(result));
    },
  );

  fastify.get(
    "/exports/:jobId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { jobId } = request.params as { jobId: string };
      const status = await exportsService.getExportStatus(jobId);
      return reply.send(success(status));
    },
  );
}
