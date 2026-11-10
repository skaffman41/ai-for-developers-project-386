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
  GetAvailabilityData,
  GetAvailabilityErrors,
  GetAvailabilityResponses,
  GetOwnerBookingsData,
  GetOwnerBookingsErrors,
  GetOwnerBookingsResponses,
} from "@call-calendar/contract/types";
import { createEventType } from "./create-event-type.ts";
import type { AttemptOptions } from "./attempts.ts";
import { databasePath, openDatabase } from "./storage.ts";

import {
  availableSlots,
  availabilityWindow,
  isCalendarDate,
  systemClock,
} from "./availability.ts";
import type { Clock } from "./availability.ts";
import { ownerBookings } from "./owner-bookings.ts";
import { eventTypeFromRow } from "./event-types.ts";

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
      assertResponse(
        id,
        reply.statusCode,
        "application/json",
        payload,
        reply.getHeaders(),
      );
      return payload;
    },
  };
}

export function buildApp(options: AttemptOptions & { now?: Clock } = {}) {
  const now = options.now ?? systemClock;
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
    await reply
      .header("X-Server-Time", now().toISOString())
      .code(200)
      .send({
        data: database
          .prepare(
            "SELECT * FROM event_types ORDER BY created_at DESC, sequence DESC",
          )
          .all()
          .map(eventTypeFromRow),
      });
  };
  app.get(operations.getHealth.path, contractRoute("getHealth"), health);
  app.get(
    operations.getEventTypes.path,
    contractRoute("getEventTypes"),
    eventTypes,
  );
  const bookings: RouteHandlers["getOwnerBookings"] = async (
    request,
    reply,
  ) => {
    const clock = now();
    await reply
      .header("X-Server-Time", clock.toISOString())
      .code(200)
      .send({
        data: ownerBookings(
          database,
          request.query?.period ?? "upcoming",
          clock,
        ),
      });
  };
  app.get<{
    Querystring: GetOwnerBookingsData["query"];
    Reply: GetOwnerBookingsErrors & GetOwnerBookingsResponses;
  }>(
    operations.getOwnerBookings.path,
    contractRoute("getOwnerBookings"),
    bookings,
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
  const availability: RouteHandlers["getAvailability"] = async (
    request,
    reply,
  ) => {
    const clock = now();
    const window = availabilityWindow(clock);
    const { eventTypeId, date = window.firstDate } = request.query;
    if (!isCalendarDate(date)) {
      await reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Укажите существующую дату в формате ГГГГ-ММ-ДД",
        },
      });
      return;
    }
    if (date < window.firstDate || date > window.lastDate) {
      await reply.code(422).send({
        error: {
          code: "TIME_UNAVAILABLE",
          message: "Дата за пределами доступных 14 дней",
        },
      });
      return;
    }
    const type = database
      .prepare("SELECT duration_minutes FROM event_types WHERE id = ?")
      .get(eventTypeId);
    if (!type) {
      await reply.code(404).send({
        error: {
          code: "EVENT_TYPE_NOT_FOUND",
          message: "Тип встречи не найден",
        },
      });
      return;
    }
    await reply.code(200).send({
      data: {
        eventTypeId,
        date,
        timeZone: "Europe/Moscow",
        ...window,
        slots: availableSlots(
          database,
          Number(type.duration_minutes),
          date,
          clock,
        ),
      },
    });
  };
  app.get<{
    Querystring: GetAvailabilityData["query"];
    Reply: GetAvailabilityErrors & GetAvailabilityResponses;
  }>(
    operations.getAvailability.path,
    contractRoute("getAvailability"),
    availability,
  );
  return app;
}
