import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import {
  AnalyticsQuerySchema,
  DcbReportQuerySchema,
  InspectorReportQuerySchema,
} from "./reports.schema";
import * as reportsService from "./reports.service";

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/reports/dcb",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const q = DcbReportQuerySchema.parse(request.query);
      const rows = await reportsService.getDCBRegister(user, {
        districtId: q.districtId,
        financialYear: q.financialYear,
        institutionId: q.institutionId,
      });
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/reports/summary",
    { preHandler: [requireAuth, requireRole("ADMIN", "CHAIRMAN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const summary = await reportsService.getSummary(user);
      return reply.send(success(summary));
    },
  );

  fastify.get(
    "/reports/analytics",
    { preHandler: [requireAuth, requireRole("ADMIN", "CHAIRMAN")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const q = AnalyticsQuerySchema.parse(request.query);
      const data = await reportsService.getAnalytics(user, {
        financialYear: q.financialYear,
      });
      return reply.send(success(data));
    },
  );

  fastify.get(
    "/reports/inspector/:id",
    { preHandler: [requireAuth, requireRole("ADMIN", "CHAIRMAN")] },
    async (request, reply) => {
      const q = InspectorReportQuerySchema.parse(request.query);
      const { id } = request.params as { id: string };
      const data = await reportsService.getInspectorReport(id, {
        financialYear: q.financialYear,
      });
      return reply.send(success(data));
    },
  );
}
