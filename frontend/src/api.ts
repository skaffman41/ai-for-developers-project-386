import { getEventTypes } from "@call-calendar/contract/sdk";
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
