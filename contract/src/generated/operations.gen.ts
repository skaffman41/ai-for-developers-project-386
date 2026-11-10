// Generated from openapi.json by scripts/api.mjs. Do not edit.
import * as schemas from "./schemas.gen.js";
export const components = {
  Health: schemas.HealthSchema,
  EventType: schemas.EventTypeSchema,
  EventTypes: schemas.EventTypesSchema,
  ReadError: schemas.ReadErrorSchema,
  CreateEventTypeInput: schemas.CreateEventTypeInputSchema,
  EventTypeDraft: schemas.EventTypeDraftSchema,
  CreatedEventType: schemas.CreatedEventTypeSchema,
  WriteError: schemas.WriteErrorSchema,
  WriteError400: schemas.WriteError400Schema,
  WriteError409: schemas.WriteError409Schema,
  WriteError422: schemas.WriteError422Schema,
  WriteError500: schemas.WriteError500Schema,
  WriteError503: schemas.WriteError503Schema,
} as const;
export const operations = {
  getHealth: {
    method: "GET",
    path: "/health",
    query: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    headers: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    body: null,
    requestMediaType: null,
    responses: {
      "200": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/Health" },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
    },
  },
  getEventTypes: {
    method: "GET",
    path: "/api/event-types",
    query: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    headers: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    body: null,
    requestMediaType: null,
    responses: {
      "200": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/EventTypes" },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
      },
    },
  },
  createEventType: {
    method: "POST",
    path: "/api/event-types",
    query: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    headers: {
      type: "object",
      additionalProperties: false,
      properties: { "idempotency-key": { type: "string", format: "uuid" } },
      required: ["idempotency-key"],
    },
    body: { $ref: "#/components/schemas/CreateEventTypeInput" },
    requestMediaType: "application/json",
    responses: {
      "201": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/CreatedEventType" },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError400" },
      },
      "409": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError409" },
      },
      "422": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError422" },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError500" },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError503" },
      },
    },
  },
} as const;
