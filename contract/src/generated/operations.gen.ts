// Generated from openapi.json by scripts/api.mjs. Do not edit.
import * as schemas from "./schemas.gen.js";
export const components = {
  Health: schemas.HealthSchema,
  EventType: schemas.EventTypeSchema,
  EventTypes: schemas.EventTypesSchema,
  ReadError: schemas.ReadErrorSchema,
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
} as const;
