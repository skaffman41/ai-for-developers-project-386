import { normalizeEventType } from "@call-calendar/contract/event-types";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  assertResponse,
  schemaErrors,
  validRequestBody,
} from "@call-calendar/contract/validation";
import type { CreateEventTypeInput } from "@call-calendar/contract/types";
import { runAttempt } from "./attempts.ts";
import type { AttemptOptions } from "./attempts.ts";

export function createEventType(
  database: DatabaseSync,
  key: string,
  raw: unknown,
  options: AttemptOptions,
) {
  return runAttempt(
    database,
    "createEventType",
    key,
    raw,
    () => {
      let errors: Record<string, string>;
      let draft: CreateEventTypeInput | undefined;
      if (!validRequestBody("createEventType", raw))
        errors = schemaErrors("CreateEventTypeInput", raw);
      else {
        const input = raw as CreateEventTypeInput;
        draft = normalizeEventType(input);
        errors = schemaErrors("EventTypeDraft", draft);
      }
      const result =
        Object.keys(errors).length || !draft
          ? {
              status: 422,
              body: {
                idempotencyKey: key,
                outcome: "rejected",
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Проверьте поля типа встречи",
                  fieldErrors: errors,
                },
              },
            }
          : (() => {
              const id = randomUUID();
              const inserted = database
                .prepare(
                  "INSERT INTO event_types(id,name,duration_minutes,description,created_at) VALUES (?,?,?,?,?)",
                )
                .run(
                  id,
                  draft.name,
                  draft.durationMinutes,
                  draft.description ?? null,
                  Date.now(),
                );
              return {
                status: 201,
                body: {
                  idempotencyKey: key,
                  data: {
                    id,
                    ...draft,
                    displayCode: `В-${String(inserted.lastInsertRowid).padStart(6, "0")}`,
                  },
                },
              };
            })();
      assertResponse(
        "createEventType",
        result.status,
        "application/json",
        result.body,
      );
      return result;
    },
    options,
  );
}
