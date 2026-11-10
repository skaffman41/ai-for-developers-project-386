import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { operations } from "@call-calendar/contract/operations";
import {
  assertResponse,
  interpretableJson,
  validReadRequest,
  validRequestEnvelope,
} from "@call-calendar/contract/validation";
import type { OperationId } from "@call-calendar/contract/validation";
import type { RouteHandlers } from "@call-calendar/contract/fastify";
import type {
  CreateEventTypeData,
  CreateEventTypeErrors,
  CreateEventTypeResponses,
  EventType,
} from "@call-calendar/contract/types";
import { createEventType } from "./create-event-type.ts";
import type { AttemptOptions } from "./attempts.ts";
import { databasePath, openDatabase } from "./storage.ts";

function contractRoute(id: OperationId) {
  return {
    async onRequest(request: FastifyRequest, reply: FastifyReply) {
      // Fastify skips GET body parsing. Reject body framing before that payload
      // can disappear from request.body; Content-Length: 0 is still bodyless.
      const headers = request.raw.headers;
      if (
        !operations[id].body &&
        (headers["transfer-encoding"] !== undefined ||
          Number(headers["content-length"] ?? 0) > 0)
      ) {
        await reply
          .header("connection", "close")
          .code(400)
          .send({
            error: {
              code: "INVALID_REQUEST",
              message: "Запрос не соответствует контракту",
            },
          });
      }
    },
    async preValidation(request: FastifyRequest, reply: FastifyReply) {
      if (
        operations[id].body
          ? !interpretableJson(request.body) ||
            !validRequestEnvelope(id, request.query, request.headers)
          : !validReadRequest(id, request.query, request.body)
      ) {
        await reply.code(400).send({
          ...(operations[id].body ? { outcome: "unknown" } : {}),
          error: {
            code: "INVALID_REQUEST",
            message: "Запрос не соответствует контракту",
          },
        });
      }
    },
    async preSerialization(
      _request: FastifyRequest,
      reply: FastifyReply,
      payload: unknown,
    ) {
      assertResponse(id, reply.statusCode, "application/json", payload);
      return payload;
    },
  };
}

export function buildApp(options: AttemptOptions = {}) {
  const database = openDatabase(databasePath());
  const app = Fastify({ logger: true });
  app.addHook("onClose", async () => database.close());
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const invalidRequest =
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500;
    const write = request.method === "POST";
    const key = request.headers["idempotency-key"];
    void reply.code(invalidRequest ? 400 : 500).send({
      ...(write
        ? {
            outcome: "unknown",
            ...(typeof key === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              key,
            )
              ? { idempotencyKey: key }
              : {}),
          }
        : {}),
      error: {
        code: invalidRequest ? "INVALID_REQUEST" : "INTERNAL_ERROR",
        message: invalidRequest
          ? "Запрос не соответствует контракту"
          : "Не удалось выполнить запрос",
      },
    });
  });
  const health: RouteHandlers["getHealth"] = async (_request, reply) => {
    await reply.code(200).send({ status: "ok" });
  };
  const eventTypes: RouteHandlers["getEventTypes"] = async (
    _request,
    reply,
  ) => {
    await reply.code(200).send({
      data: database
        .prepare(
          "SELECT * FROM event_types ORDER BY created_at DESC, sequence DESC",
        )
        .all()
        .map((row): EventType => ({
          id: String(row.id),
          name: String(row.name),
          durationMinutes: Number(row.duration_minutes),
          ...(row.description === null
            ? {}
            : { description: String(row.description) }),
          displayCode: `В-${String(row.sequence).padStart(6, "0")}`,
        })),
    });
  };
  app.get(operations.getHealth.path, contractRoute("getHealth"), health);
  app.get(
    operations.getEventTypes.path,
    contractRoute("getEventTypes"),
    eventTypes,
  );
  const create: RouteHandlers["createEventType"] = async (request, reply) => {
    const result = createEventType(
      database,
      request.headers["idempotency-key"],
      request.body,
      options,
    );
    // The transaction returns only contracted, persisted bodies (including refusals).
    await reply
      .code(
        result.status as keyof (CreateEventTypeErrors &
          CreateEventTypeResponses),
      )
      .send(
        result.body as (CreateEventTypeErrors &
          CreateEventTypeResponses)[keyof (CreateEventTypeErrors &
          CreateEventTypeResponses)],
      );
  };
  app.post<{
    Body: CreateEventTypeData["body"];
    Headers: CreateEventTypeData["headers"];
    Reply: CreateEventTypeErrors & CreateEventTypeResponses;
  }>(operations.createEventType.path, contractRoute("createEventType"), create);
  return app;
}
