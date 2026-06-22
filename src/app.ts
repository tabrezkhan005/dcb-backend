import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { AppError } from "./utils/errors";
import { error } from "./utils/response";
import authPlugin from "./plugins/auth.plugin";
import corsPlugin from "./plugins/cors.plugin";
import helmetPlugin from "./plugins/helmet.plugin";
import rateLimitPlugin from "./plugins/rateLimit.plugin";
import { authRoutes } from "./modules/auth/auth.routes";
import { collectionsRoutes } from "./modules/collections/collections.routes";
import { demandsRoutes } from "./modules/demands/demands.routes";
import { districtsRoutes } from "./modules/districts/districts.routes";
import { exportsRoutes } from "./modules/exports/exports.routes";
import { institutionsRoutes } from "./modules/institutions/institutions.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { usersRoutes } from "./modules/users/users.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    trustProxy: true,
  });

  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(authPlugin);

  fastify.get("/health", async () => ({ status: "ok" }));

  fastify.addHook("onResponse", (request, reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "request completed",
    );
    done();
  });

  const api = async (instance: FastifyInstance) => {
    await instance.register(authRoutes);
    await instance.register(districtsRoutes);
    await instance.register(institutionsRoutes);
    await instance.register(demandsRoutes);
    await instance.register(collectionsRoutes);
    await instance.register(usersRoutes);
    await instance.register(reportsRoutes);
    await instance.register(exportsRoutes);
  };

  await fastify.register(api, { prefix: "/api/v1" });

  fastify.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send(error("Not Found", "NOT_FOUND"));
  });

  fastify.setErrorHandler((err, request, reply) => {
    if (reply.sent) {
      return;
    }
    if (err instanceof AppError) {
      void reply
        .code(err.statusCode)
        .send(error(err.message, err.code));
      return;
    }
    request.log.error(err);
    void reply
      .code(500)
      .send(error("Internal Server Error", "INTERNAL"));
  });

  return fastify;
}
