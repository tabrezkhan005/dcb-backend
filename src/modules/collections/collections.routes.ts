import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { AppError } from "../../utils/errors";
import { success } from "../../utils/response";
import {
  AcceptCollectionSchema,
  CollectionListQuerySchema,
  QueryCollectionSchema,
  SubmitCollectionSchema,
} from "./collections.schema";
import * as collectionsService from "./collections.service";

export async function collectionsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/collections",
    { preHandler: [requireAuth, requireRole("INSPECTOR")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = SubmitCollectionSchema.parse(request.body);
      const row = await collectionsService.submitCollection(
        {
          demandId: body.demandId,
          amountCollected: body.amountCollected,
          paymentMode: body.paymentMode,
          referenceNo: body.referenceNo,
          idempotencyKey: body.idempotencyKey,
        },
        user,
      );
      return reply.code(201).send(success(row));
    },
  );

  fastify.get(
    "/collections",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const q = CollectionListQuerySchema.parse(request.query);
      const rows = await collectionsService.getCollections(user, {
        status: q.status,
        districtId: q.districtId,
        inspectorId: q.inspectorId,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      });
      return reply.send(success(rows));
    },
  );

  fastify.get(
    "/collections/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const row = await collectionsService.getCollectionById(id, user);
      return reply.send(success(row));
    },
  );

  fastify.get(
    "/collections/:id/receipt-url",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const { id } = request.params as { id: string };
      const result = await collectionsService.getReceiptDownloadUrl(id, user);
      return reply.send(success(result));
    },
  );

  fastify.patch(
    "/collections/:id/accept",
    { preHandler: [requireAuth, requireRole("ACCOUNTS")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      AcceptCollectionSchema.parse(request.body ?? {});
      const { id } = request.params as { id: string };
      const row = await collectionsService.acceptCollection(id, user);
      return reply.send(success(row));
    },
  );

  fastify.patch(
    "/collections/:id/query",
    { preHandler: [requireAuth, requireRole("ACCOUNTS")] },
    async (request, reply) => {
      const user = request.user;
      if (user === undefined) throw AppError.unauthorized();
      const body = QueryCollectionSchema.parse(request.body);
      const { id } = request.params as { id: string };
      const row = await collectionsService.queryCollection(id, body.note, user);
      return reply.send(success(row));
    },
  );
}
