import type { SQLOutputValue } from "node:sqlite";
import type { EventType } from "@call-calendar/contract/types";

export function eventTypeFromRow(
  row: Record<string, SQLOutputValue>,
): EventType {
  return {
    id: String(row.id),
    name: String(row.name),
    durationMinutes: Number(row.duration_minutes),
    ...(row.description === null
      ? {}
      : { description: String(row.description) }),
    displayCode: `В-${String(row.sequence).padStart(6, "0")}`,
  };
}
