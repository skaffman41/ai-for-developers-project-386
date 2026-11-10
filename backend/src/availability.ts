import type { DatabaseSync } from "node:sqlite";
import type { Slot } from "@call-calendar/contract/types";

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
const dayMilliseconds = 86_400_000;

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function availabilityWindow(now: Date) {
  const firstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const lastDate = new Date(
    Date.parse(`${firstDate}T00:00:00Z`) + 13 * dayMilliseconds,
  )
    .toISOString()
    .slice(0, 10);
  return { firstDate, lastDate, asOf: now.toISOString() };
}

// This shared calculation is also suitable under the booking write lock. Slots
// are derived intervals; neither reading them nor selecting one reserves time.
export function scheduledSlots(
  durationMinutes: number,
  date: string,
  now: Date,
): Slot[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return [];
  const opensAt = Date.parse(`${date}T09:00:00+03:00`);
  const closesAt = Date.parse(`${date}T18:00:00+03:00`);
  const slots: Slot[] = [];
  for (
    let start = opensAt;
    start + durationMinutes * 60_000 <= closesAt;
    start += 30 * 60_000
  ) {
    const end = start + durationMinutes * 60_000;
    if (start <= now.getTime()) continue;
    slots.push({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
  }
  return slots;
}

export function availableSlots(
  database: DatabaseSync,
  durationMinutes: number,
  date: string,
  now: Date,
): Slot[] {
  const occupied = database
    .prepare(
      "SELECT starts_at, ends_at FROM bookings WHERE starts_at < ? AND ends_at > ?",
    )
    .all(
      Date.parse(`${date}T18:00:00+03:00`),
      Date.parse(`${date}T09:00:00+03:00`),
    );
  return scheduledSlots(durationMinutes, date, now).filter(
    (slot) =>
      !occupied.some(
        (row) =>
          Number(row.starts_at) < Date.parse(slot.endsAt) &&
          Number(row.ends_at) > Date.parse(slot.startsAt),
      ),
  );
}
