import { createEventType, getEventTypes } from "@call-calendar/contract/sdk";
import { assertResponse } from "@call-calendar/contract/validation";

export async function loadEventTypes(signal: AbortSignal) {
  // SDK validation only runs on success in the pinned version. Validate every
  // status/media type through its transport so errors cannot bypass the contract.
  return getEventTypes({
    signal,
    throwOnError: true,
    fetch: async (request) => {
      const response = await fetch(request);
      const data: unknown = await response.clone().json();
      assertResponse(
        "getEventTypes",
        response.status,
        response.headers.get("content-type"),
        data,
      );
      return response;
    },
  }).then((result) => result.data!.data);
}

export async function sendEventType(
  key: string,
  payload: import("@call-calendar/contract/types").CreateEventTypeInput,
) {
  const result = await createEventType({
    body: payload,
    headers: { "Idempotency-Key": key },
    fetch: async (request) => {
      const response = await fetch(request);
      const data: unknown = await response.clone().json();
      assertResponse(
        "createEventType",
        response.status,
        response.headers.get("content-type"),
        data,
      );
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
