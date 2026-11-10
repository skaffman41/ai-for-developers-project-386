import type {
  CreateEventTypeInput,
  EventTypeDraft,
} from "./generated/types.gen.js";

// Shared normalization leaves the original input intact for transport and
// attempt identity. The generated EventTypeDraft schema checks its result.
export function normalizeEventType(
  input: CreateEventTypeInput,
): EventTypeDraft {
  const description = input.description?.trim();
  return {
    name: input.name.trim(),
    durationMinutes: input.durationMinutes,
    ...(description ? { description } : {}),
  };
}
