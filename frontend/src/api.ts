import {
  createEventType,
  getEventTypes,
  getAvailability,
} from "@call-calendar/contract/sdk";
import { assertResponse } from "@call-calendar/contract/validation";
import type { OperationId } from "@call-calendar/contract/validation";

function validatedFetch(operation: OperationId): typeof fetch {
  // SDK validation only runs on success in the pinned version. Validate every
  // status/media type through its transport so errors cannot bypass the contract.
  return async (request, init) => {
    const response = await fetch(request, init);
    const data: unknown = await response.clone().json();
    assertResponse(
      operation,
      response.status,
      response.headers.get("content-type"),
      data,
    );
    return response;
  };
}

export class AvailabilityDateExpired extends Error {}

export async function loadEventTypes(signal: AbortSignal) {
  return getEventTypes({
    signal,
    throwOnError: true,
    fetch: validatedFetch("getEventTypes"),
  }).then((result) => result.data!.data);
}

export async function loadAvailability(
  eventTypeId: string,
  date: string | undefined,
  signal: AbortSignal,
) {
  const result = await getAvailability({
    query: { eventTypeId, ...(date === undefined ? {} : { date }) },
    signal,
    throwOnError: false,
    fetch: validatedFetch("getAvailability"),
  });
  if (result.error) {
    // A returned response has passed transport validation. A network or invalid
    // response failure has no response and must never trigger calendar recovery.
    if (
      result.response?.status === 422 &&
      result.error.error.code === "TIME_UNAVAILABLE"
    ) {
      throw new AvailabilityDateExpired(
        "Дата больше не входит в доступный горизонт",
      );
    }
    throw result.error;
  }
  return result.data!.data;
}

export async function sendEventType(
  key: string,
  payload: import("@call-calendar/contract/types").CreateEventTypeInput,
) {
  const result = await createEventType({
    body: payload,
    headers: { "Idempotency-Key": key },
    fetch: async (request) => {
      const response = await validatedFetch("createEventType")(request);
      const data: unknown = await response.clone().json();
      if (
        !data ||
        typeof data !== "object" ||
        !("idempotencyKey" in data) ||
        data.idempotencyKey !== key
      )
        throw new Error("Unrelated attempt response");
      return response;
    },
  });
  if (result.data) return { type: "created" as const, data: result.data.data };
  if (result.error?.outcome === "rejected")
    return { type: "rejected" as const, error: result.error.error };
  throw new Error("Unknown attempt outcome");
}
