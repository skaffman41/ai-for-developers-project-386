import type { DatabaseSync } from "node:sqlite";
import type {
  Booking,
  GetOwnerBookingsData,
} from "@call-calendar/contract/types";
import { eventTypeFromRow } from "./event-types.ts";

export function ownerBookings(
  database: DatabaseSync,
  period: NonNullable<GetOwnerBookingsData["query"]>["period"],
  now: Date,
): Booking[] {
  const where =
    period === "all"
      ? ""
      : period === "past"
        ? "WHERE b.ends_at <= ?"
        : "WHERE b.ends_at > ?";
  const order = period === "past" ? "DESC" : "ASC";
  return database
    .prepare(
      `SELECT b.*, t.name, t.duration_minutes, t.description, t.sequence FROM bookings b JOIN event_types t ON t.id=b.event_type_id ${where} ORDER BY b.starts_at ${order}, b.id ASC`,
    )
    .all(...(period === "all" ? [] : [now.getTime()]))
    .map((row) => ({
      id: String(row.id),
      eventType: eventTypeFromRow({ ...row, id: row.event_type_id }),
      startsAt: new Date(Number(row.starts_at)).toISOString(),
      endsAt: new Date(Number(row.ends_at)).toISOString(),
      guestName: String(row.guest_name),
      guestEmail: String(row.guest_email),
    }));
}
