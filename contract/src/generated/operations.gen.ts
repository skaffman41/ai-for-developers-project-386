// Generated from openapi.json by scripts/api.mjs. Do not edit.
import * as schemas from "./schemas.gen.js";
export const components = {
  Availability: schemas.AvailabilitySchema,
  AvailabilityResponse: schemas.AvailabilityResponseSchema,
  Booking: schemas.BookingSchema,
  BookingDraft: schemas.BookingDraftSchema,
  BookingError404: schemas.BookingError404Schema,
  BookingError409: schemas.BookingError409Schema,
  BookingError422: schemas.BookingError422Schema,
  BookingRefusal409: schemas.BookingRefusal409Schema,
  Bookings: schemas.BookingsSchema,
  CreateBookingInput: schemas.CreateBookingInputSchema,
  CreateEventTypeInput: schemas.CreateEventTypeInputSchema,
  CreatedBooking: schemas.CreatedBookingSchema,
  CreatedEventType: schemas.CreatedEventTypeSchema,
  EventType: schemas.EventTypeSchema,
  EventTypeDraft: schemas.EventTypeDraftSchema,
  EventTypes: schemas.EventTypesSchema,
  Health: schemas.HealthSchema,
  NonEmptyString: schemas.NonEmptyStringSchema,
  ReadError: schemas.ReadErrorSchema,
  Slot: schemas.SlotSchema,
  UtcInstant: schemas.UtcInstantSchema,
  WriteError: schemas.WriteErrorSchema,
  WriteError400: schemas.WriteError400Schema,
  WriteError409: schemas.WriteError409Schema,
  WriteError422: schemas.WriteError422Schema,
  WriteError500: schemas.WriteError500Schema,
  WriteError503: schemas.WriteError503Schema,
} as const;
export const operations = {
  getAvailability: {
    method: "GET",
    path: "/api/availability",
    query: {
      type: "object",
      additionalProperties: false,
      properties: {
        eventTypeId: { type: "string", minLength: 1 },
        date: { type: "string" },
      },
      required: ["eventTypeId"],
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
        schema: { $ref: "#/components/schemas/AvailabilityResponse" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "404": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "422": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
    },
  },
  createBooking: {
    method: "POST",
    path: "/api/bookings",
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
    body: { $ref: "#/components/schemas/CreateBookingInput" },
    requestMediaType: "application/json",
    responses: {
      "201": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/CreatedBooking" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError400" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "404": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/BookingError404" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "409": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/BookingError409" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "422": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/BookingError422" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError500" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError503" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
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
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {
            "x-server-time": { $ref: "#/components/schemas/UtcInstant" },
          },
          required: ["x-server-time"],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
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
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError400" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "409": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError409" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "422": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError422" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError500" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/WriteError503" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
    },
  },
  getOwnerBookings: {
    method: "GET",
    path: "/api/owner/bookings",
    query: {
      type: "object",
      additionalProperties: false,
      properties: {
        period: { type: "string", enum: ["upcoming", "past", "all"] },
      },
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
        schema: { $ref: "#/components/schemas/Bookings" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {
            "x-server-time": { $ref: "#/components/schemas/UtcInstant" },
          },
          required: ["x-server-time"],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
    },
  },
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
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "400": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "500": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
      "503": {
        mediaType: "application/json",
        schema: { $ref: "#/components/schemas/ReadError" },
        headers: {
          type: "object",
          additionalProperties: true,
          properties: {},
          required: [],
        },
      },
    },
  },
} as const;
