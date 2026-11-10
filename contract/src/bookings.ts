import type {
  BookingDraft,
  CreateBookingInput,
} from "./generated/types.gen.js";

export function normalizeBooking(input: CreateBookingInput): BookingDraft {
  const email = input.guestEmail.trim();
  const at = email.lastIndexOf("@");
  return {
    eventTypeId: input.eventTypeId,
    startsAt: input.startsAt,
    guestName: input.guestName.trim(),
    guestEmail:
      at < 0
        ? email
        : email.slice(0, at + 1) + email.slice(at + 1).toLowerCase(),
  };
}
