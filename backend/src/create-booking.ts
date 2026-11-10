import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { normalizeBooking } from "@call-calendar/contract/bookings";
import {
  assertResponse,
  schemaErrors,
  validRequestBody,
} from "@call-calendar/contract/validation";
import type {
  BookingDraft,
  CreateBookingInput,
} from "@call-calendar/contract/types";
import { eventTypeFromRow } from "./event-types.ts";
import { runAttempt } from "./attempts.ts";
import type { AttemptOptions } from "./attempts.ts";
import { availabilityWindow, scheduledSlots } from "./availability.ts";
import type { Clock } from "./availability.ts";

export function createBooking(
  database: DatabaseSync,
  key: string,
  raw: unknown,
  now: Clock,
  options: AttemptOptions,
) {
  return runAttempt(
    database,
    "createBooking",
    key,
    raw,
    () => {
      function refused(
        status: number,
        code: string,
        message: string,
        fieldErrors?: Record<string, string>,
      ) {
        return {
          status,
          body: {
            idempotencyKey: key,
            outcome: "rejected",
            error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
          },
        };
      }
      let draft: BookingDraft | undefined;
      let errors: Record<string, string>;
      if (!validRequestBody("createBooking", raw))
        errors = schemaErrors("CreateBookingInput", raw);
      else {
        draft = normalizeBooking(raw as CreateBookingInput);
        errors = schemaErrors("BookingDraft", draft);
      }
      const result = (() => {
        if (!draft || Object.keys(errors).length)
          return refused(
            422,
            "VALIDATION_ERROR",
            "Проверьте контакты и выбранное время",
            errors,
          );
        const row = database
          .prepare("SELECT * FROM event_types WHERE id = ?")
          .get(draft.eventTypeId);
        if (!row)
          return refused(404, "EVENT_TYPE_NOT_FOUND", "Тип встречи не найден");
        const eventType = eventTypeFromRow(row);
        const clock = now();
        const window = availabilityWindow(clock);
        const start = Date.parse(draft.startsAt);
        // Date.parse truncates sub-millisecond precision and does not represent
        // leap seconds. Refuse these as time rules, never silently round a start.
        if (!Number.isFinite(start) || !/:00(?:\.0+)?Z$/.test(draft.startsAt))
          return refused(
            422,
            "TIME_UNAVAILABLE",
            "Выбранное время не соответствует сетке доступных интервалов. Выберите другой интервал.",
          );
        const date = new Date(start + 3 * 60 * 60_000)
          .toISOString()
          .slice(0, 10);
        const slot =
          date >= window.firstDate && date <= window.lastDate
            ? scheduledSlots(eventType.durationMinutes, date, clock).find(
                (candidate) => Date.parse(candidate.startsAt) === start,
              )
            : undefined;
        if (!slot)
          return refused(
            422,
            "TIME_UNAVAILABLE",
            "Выбранное время прошло или больше не соответствует правилам. Выберите другой интервал.",
          );
        const end = Date.parse(slot.endsAt);
        if (
          database
            .prepare(
              "SELECT id FROM bookings WHERE starts_at < ? AND ends_at > ? LIMIT 1",
            )
            .get(end, start)
        )
          return refused(409, "SLOT_TAKEN", "Слот уже занят");
        const id = randomUUID();
        database
          .prepare(
            "INSERT INTO bookings(id,event_type_id,starts_at,ends_at,guest_name,guest_email) VALUES (?,?,?,?,?,?)",
          )
          .run(id, eventType.id, start, end, draft.guestName, draft.guestEmail);
        return {
          status: 201,
          body: {
            idempotencyKey: key,
            data: {
              id,
              eventType,
              ...slot,
              guestName: draft.guestName,
              guestEmail: draft.guestEmail,
            },
          },
        };
      })();
      assertResponse(
        "createBooking",
        result.status,
        "application/json",
        result.body,
      );
      return result;
    },
    options,
  );
}
