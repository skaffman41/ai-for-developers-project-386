import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Календарь звонков — HTTP API" })
@info(#{ version: "1.0.0" })
@doc("Работающие операции. Новые операции добавляются вместе с реализацией.")
namespace CallCalendar;

@doc(Description)
model JsonResponse<
  Status extends integer,
  Body,
  Description extends valueof string
> {
  @statusCode statusCode: Status;
  @body body: Body;
}

@doc(Description)
model TimedResponse<Body, Description extends valueof string> {
  @statusCode statusCode: 200;
  @body body: Body;

  @doc("Authoritative UTC server time of this successful read. Owner classification and last successful-load display use this instant; refresh explicitly to update it.")
  @header("X-Server-Time")
  serverTime: UtcInstant;
}

// A string scalar preserves the API's UTC JSON timestamp even in HTTP headers.
@format("date-time")
@pattern("Z$")
scalar UtcInstant extends string;

@minLength(1)
scalar NonEmptyString extends string;

model Health {
  status: "ok";
  ...Record<never>;
}

model EventType {
  @minLength(1) id: string;

  @minLength(1)
  @maxLength(100)
  @pattern("^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$")
  name: string;

  @minValue(1) @maxValue(540) durationMinutes: integer;

  @minLength(1)
  @maxLength(2000)
  @pattern("^\\S(?:[\\s\\S]*\\S)?$")
  description?: string;

  @pattern("^В-[0-9]{6,}$") displayCode: string;
  ...Record<never>;
}

model EventTypes {
  data: EventType[];
  ...Record<never>;
}

model ReadError {
  error: {
    code:
      | "INVALID_REQUEST"
      | "INTERNAL_ERROR"
      | "TEMPORARILY_UNAVAILABLE"
      | "EVENT_TYPE_NOT_FOUND"
      | "VALIDATION_ERROR"
      | "TIME_UNAVAILABLE";
    @minLength(1) message: string;
    ...Record<never>;
  };
  ...Record<never>;
}

model CreateEventTypeInput {
  name: string;
  durationMinutes: integer;
  description?: string;
  ...Record<never>;
}

model EventTypeDraft {
  @minLength(1)
  @maxLength(100)
  @pattern("^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$")
  name: string;

  @minValue(1) @maxValue(540) durationMinutes: integer;

  @minLength(1)
  @maxLength(2000)
  @pattern("^\\S(?:[\\s\\S]*\\S)?$")
  description?: string;

  ...Record<never>;
}

model CreatedEventType {
  @format("uuid") idempotencyKey: string;
  data: EventType;
  ...Record<never>;
}

model WriteError {
  @format("uuid") idempotencyKey?: string;
  outcome: "rejected" | "unknown";
  error: {
    code:
      | "VALIDATION_ERROR"
      | "IDEMPOTENCY_KEY_REUSED"
      | "INVALID_REQUEST"
      | "INTERNAL_ERROR"
      | "TEMPORARILY_UNAVAILABLE";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model WriteError400 {
  @format("uuid") idempotencyKey?: string;
  outcome: "unknown";
  error: {
    code: "INVALID_REQUEST";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model WriteError409 {
  @format("uuid") idempotencyKey: string;
  outcome: "unknown";
  error: {
    code: "IDEMPOTENCY_KEY_REUSED";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model WriteError422 {
  @format("uuid") idempotencyKey: string;
  outcome: "rejected";
  error: {
    code: "VALIDATION_ERROR";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model WriteError500 {
  @format("uuid") idempotencyKey?: string;
  outcome: "unknown";
  error: {
    code: "INTERNAL_ERROR";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model WriteError503 {
  @format("uuid") idempotencyKey?: string;
  outcome: "unknown";
  error: {
    code: "TEMPORARILY_UNAVAILABLE";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model Slot {
  @format("date-time") @pattern("Z$") startsAt: string;
  @format("date-time") @pattern("Z$") endsAt: string;
  ...Record<never>;
}

model Availability {
  @minLength(1) eventTypeId: string;
  @format("date") @pattern("^[0-9]{4}-[0-9]{2}-[0-9]{2}$") date: string;
  timeZone: "Europe/Moscow";
  @format("date") @pattern("^[0-9]{4}-[0-9]{2}-[0-9]{2}$") firstDate: string;
  @format("date") @pattern("^[0-9]{4}-[0-9]{2}-[0-9]{2}$") lastDate: string;
  @format("date-time") @pattern("Z$") asOf: string;
  slots: Slot[];
  ...Record<never>;
}

model AvailabilityResponse {
  data: Availability;
  ...Record<never>;
}

model Booking {
  @minLength(1) id: string;
  eventType: EventType;
  @format("date-time") @pattern("Z$") startsAt: string;
  @format("date-time") @pattern("Z$") endsAt: string;

  @minLength(1)
  @maxLength(100)
  @pattern("^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$")
  guestName: string;

  @format("email") @maxLength(254) guestEmail: string;
  ...Record<never>;
}

model Bookings {
  data: Booking[];
  ...Record<never>;
}

model CreateBookingInput {
  eventTypeId: string;
  startsAt: string;
  guestName: string;
  guestEmail: string;
  ...Record<never>;
}

model BookingDraft {
  @minLength(1) eventTypeId: string;
  @format("date-time") @pattern("Z$") startsAt: string;

  @minLength(1)
  @maxLength(100)
  @pattern("^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$")
  guestName: string;

  @format("email") @maxLength(254) guestEmail: string;
  ...Record<never>;
}

model CreatedBooking {
  @format("uuid") idempotencyKey: string;
  data: Booking;
  ...Record<never>;
}

model BookingError404 {
  @format("uuid") idempotencyKey: string;
  outcome: "rejected";
  error: {
    code: "EVENT_TYPE_NOT_FOUND";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model BookingRefusal409 {
  @format("uuid") idempotencyKey: string;
  outcome: "rejected";
  error: {
    code: "SLOT_TAKEN";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

model BookingError422 {
  @format("uuid") idempotencyKey: string;
  outcome: "rejected";
  error: {
    code: "VALIDATION_ERROR" | "TIME_UNAVAILABLE";
    @minLength(1) message: string;
    fieldErrors?: Record<NonEmptyString>;
    ...Record<never>;
  };
  ...Record<never>;
}

@oneOf
union BookingError409 {
  WriteError409,
  BookingRefusal409,
}

@route("/health")
@get
@operationId("getHealth")
@summary("Проверить здоровье сервиса")
op getHealth():
  | JsonResponse<200, Health, "Service is healthy">
  | JsonResponse<400, ReadError, "Invalid request">
  | JsonResponse<500, ReadError, "Internal error">
  | JsonResponse<503, ReadError, "Temporarily unavailable">;

@route("/api/event-types")
@get
@operationId("getEventTypes")
@summary("Получить типы встреч, новые первыми")
@doc("Порядок: время создания по убыванию, затем монотонный номер создания по убыванию. Названия могут совпадать; displayCode устойчив и уникален.")
op getEventTypes():
  | TimedResponse<EventTypes, "All meeting types, including an empty list">
  | JsonResponse<400, ReadError, "Invalid request">
  | JsonResponse<500, ReadError, "Internal error">
  | JsonResponse<503, ReadError, "Temporarily unavailable">;

@route("/api/event-types")
@post
@operationId("createEventType")
@summary("Создать тип встречи с сохранённым результатом попытки")
@doc("Idempotency-Key — UUID. Сравниваются исходные значения JSON, порядок свойств незначим. Структурные ошибки parseable JSON с действительным ключом сохраняются как окончательный VALIDATION_ERROR. Нормализация trim явная, длина проверяется после неё. Переполненные при разборе JSON числа (например 1e400) нельзя интерпретировать: INVALID_REQUEST/unknown до регистрации попытки. rejected возвращается только после commit; технический сбой оставляет unknown. Результаты не имеют TTL.")
op createEventType(
  @header("Idempotency-Key") @format("uuid") idempotencyKey: string,
  @body body: CreateEventTypeInput,
):
  | JsonResponse<201, CreatedEventType, "Created or saved successful result">
  | JsonResponse<400, WriteError400, "Uninterpretable request">
  | JsonResponse<409, WriteError409, "Key reused with different original data">
  | JsonResponse<422, WriteError422, "Saved validation refusal">
  | JsonResponse<500, WriteError500, "Unknown technical outcome">
  | JsonResponse<
      503,
      WriteError503,
      "Temporarily unavailable; unknown outcome"
    >;

@route("/api/availability")
@get
@operationId("getAvailability")
@summary("Получить свободные интервалы по московскому времени")
@doc("Сегодня и следующие 13 московских дней; будни 09:00–18:00, начала через 30 минут строго после asOf. Чтение не резервирует время.")
op getAvailability(
  @query("eventTypeId") @minLength(1) eventTypeId: string,
  @query("date") date?: string,
):
  | JsonResponse<
      200,
      AvailabilityResponse,
      "Complete available intervals and authoritative Moscow calendar boundaries"
    >
  | JsonResponse<400, ReadError, "Invalid request">
  | JsonResponse<500, ReadError, "Internal error">
  | JsonResponse<503, ReadError, "Temporarily unavailable">
  | JsonResponse<404, ReadError, "Unknown event type">
  | JsonResponse<
      422,
      ReadError,
      "Invalid date or outside availability horizon"
    >;

@route("/api/owner/bookings")
@get
@operationId("getOwnerBookings")
@summary("Бронирования владельца календаря")
@doc("Whole saved history, independent of the guest horizon. Default upcoming: endsAt > X-Server-Time, ascending startsAt. past: endsAt <= X-Server-Time, descending startsAt. all: ascending startsAt. Equal starts use ascending opaque id.")
op getOwnerBookings(@query("period") period?: "upcoming" | "past" | "all"):
  | TimedResponse<Bookings, "Бронирования выбранного периода">
  | JsonResponse<400, ReadError, "Ошибка чтения">
  | JsonResponse<500, ReadError, "Ошибка чтения">
  | JsonResponse<503, ReadError, "Ошибка чтения">;

@route("/api/bookings")
@post
@operationId("createBooking")
@summary("Подтвердить бронирование с безопасным повтором")
@doc("Idempotency-Key — UUID. Сравниваются исходные значения JSON, порядок свойств незначим. Структурные ошибки parseable JSON с действительным ключом сохраняются как окончательный VALIDATION_ERROR. Нормализация trim явная, длина проверяется после неё. Переполненные при разборе JSON числа (например 1e400) нельзя интерпретировать: INVALID_REQUEST/unknown до регистрации попытки. rejected возвращается только после commit; технический сбой оставляет unknown. Результаты не имеют TTL.")
op createBooking(
  @header("Idempotency-Key") @format("uuid") idempotencyKey: string,
  @body body: CreateBookingInput,
):
  | JsonResponse<201, CreatedBooking, "Saved result">
  | JsonResponse<400, WriteError400, "Uninterpretable request">
  | JsonResponse<
      409,
      BookingError409,
      "Saved slot conflict or unknown reused key"
    >
  | JsonResponse<422, BookingError422, "Saved result">
  | JsonResponse<500, WriteError500, "Unknown technical outcome">
  | JsonResponse<503, WriteError503, "Temporarily unavailable; unknown outcome">
  | JsonResponse<404, BookingError404, "Saved result">;
