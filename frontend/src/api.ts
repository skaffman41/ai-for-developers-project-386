import {
  createEventType,
  createBooking,
  getEventTypes,
  getAvailability,
  getOwnerBookings,
} from "@call-calendar/contract/sdk";
import { assertResponse } from "@call-calendar/contract/validation";
import type { OperationId } from "@call-calendar/contract/validation";

function validatedFetch(
  operation: OperationId,
  attemptKey?: string,
): typeof fetch {
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
      Object.fromEntries(response.headers),
    );
    if (
      attemptKey !== undefined &&
      (!data ||
        typeof data !== "object" ||
        !("idempotencyKey" in data) ||
        data.idempotencyKey !== attemptKey)
    )
      throw new Error("Unrelated attempt response");
    return response;
  };
}

export class AvailabilityDateExpired extends Error {}

export async function loadEventTypes(signal: AbortSignal) {
  return (await loadOwnerEventTypes(signal)).values;
}

export async function loadOwnerEventTypes(signal: AbortSignal) {
  return getEventTypes({
    signal,
    throwOnError: true,
    fetch: validatedFetch("getEventTypes"),
  }).then((result) => ({
    values: result.data!.data,
    asOf: result.response.headers.get("x-server-time")!,
  }));
}

export async function loadOwnerBookings(
  period: NonNullable<
    import("@call-calendar/contract/types").GetOwnerBookingsData["query"]
  >["period"],
  signal: AbortSignal,
) {
  const result = await getOwnerBookings({
    query: { period },
    signal,
    throwOnError: true,
    fetch: validatedFetch("getOwnerBookings"),
  });
  return {
    values: result.data!.data,
    asOf: result.response.headers.get("x-server-time")!,
  };
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
    fetch: validatedFetch("createEventType", key),
  });
  if (result.data) return { type: "created" as const, data: result.data.data };
  if (result.error?.outcome === "rejected")
    return { type: "rejected" as const, error: result.error.error };
  throw new Error("Unknown attempt outcome");
}

export async function sendBooking(
  key: string,
  payload: import("@call-calendar/contract/types").CreateBookingInput,
) {
  const result = await createBooking({
    body: payload,
    headers: { "Idempotency-Key": key },
    fetch: validatedFetch("createBooking", key),
  });
  if (result.data) return { type: "created" as const, data: result.data.data };
  if (result.error?.outcome === "rejected")
    return { type: "rejected" as const, error: result.error.error };
  throw new Error("Unknown attempt outcome");
}
