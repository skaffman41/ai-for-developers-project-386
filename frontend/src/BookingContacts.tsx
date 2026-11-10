import { useEffect, useRef, useState } from "react";
import type {
  Booking,
  CreateBookingInput,
  EventType,
  Slot,
} from "@call-calendar/contract/types";
import { normalizeBooking } from "@call-calendar/contract/bookings";
import {
  assertResponse,
  schemaErrors,
  validRequestBody,
} from "@call-calendar/contract/validation";
import { completeAttempt, readAttempt, saveAttempt } from "./attempts.ts";
import type { PendingAttempt } from "./attempts.ts";
import { sendBooking } from "./api.ts";

const storageName = "call-calendar:createBooking";
const confirmationName = "call-calendar:bookingConfirmation";
type Context = { input: CreateBookingInput; eventType: EventType; slot: Slot };
export type RestoredBooking = {
  pending?: PendingAttempt<Context>;
  confirmation?: Booking;
  failed?: boolean;
};
export function restoreBooking(): RestoredBooking {
  try {
    const pending = readAttempt<Context>(storageName, (value) => {
      if (
        !value ||
        typeof value !== "object" ||
        !("input" in value) ||
        !("eventType" in value) ||
        !("slot" in value)
      )
        return false;
      const context = value as Context;
      return (
        Boolean(validRequestBody("createBooking", context.input)) &&
        !Object.keys(schemaErrors("EventType", context.eventType)).length &&
        !Object.keys(schemaErrors("Slot", context.slot)).length &&
        context.input.eventTypeId === context.eventType.id &&
        context.input.startsAt === context.slot.startsAt
      );
    });
    if (pending) return { pending };
    const raw = sessionStorage.getItem(confirmationName);
    if (raw === null) return {};
    const value: unknown = JSON.parse(raw);
    assertResponse("createBooking", 201, "application/json", value);
    return { confirmation: (value as { data: Booking }).data };
  } catch {
    return { failed: true };
  }
}
const date = (instant: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "full",
  }).format(new Date(instant));
const time = (instant: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
function Summary({ eventType, slot }: { eventType: EventType; slot: Slot }) {
  return (
    <div className="booking-summary">
      <h3>{eventType.name}</h3>
      <p>
        {eventType.durationMinutes} мин. · {eventType.displayCode}
      </p>
      <p>{date(slot.startsAt)}</p>
      <p>
        {time(slot.startsAt)}–{time(slot.endsAt)} · Europe/Moscow
      </p>
    </div>
  );
}
export function BookingConfirmation({ booking }: { booking: Booking }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="booking-confirmation">
      <h2 ref={heading} tabIndex={-1}>
        Встреча забронирована
      </h2>
      <p>Сохраните детали встречи с этого экрана. Письмо на email не придёт.</p>
      <Summary eventType={booking.eventType} slot={booking} />
      <p>{booking.guestName}</p>
      <p>{booking.guestEmail}</p>
    </section>
  );
}
export function BookingContacts({
  eventType,
  slot,
  active,
  restored,
  onBack,
  onRefused,
  onConfirmed,
  onLocked,
}: {
  eventType: EventType;
  slot?: Slot;
  active: boolean;
  restored: RestoredBooking;
  onBack: () => void;
  onLocked: (locked: boolean) => void;
  onRefused: (message?: string) => void;
  onConfirmed: (booking: Booking) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    guestName: restored.pending?.payload.input.guestName ?? "",
    guestEmail: restored.pending?.payload.input.guestEmail ?? "",
  }));
  const [pending, setPending] = useState(restored.pending);
  const [phase, setPhase] = useState<"idle" | "sending" | "unknown">(
    restored.pending ? "unknown" : "idle",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const sending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusErrors = useRef(false);
  useEffect(() => {
    if (active) heading.current?.focus();
  }, [active]);
  useEffect(() => {
    if (phase === "idle" && focusErrors.current) {
      focusErrors.current = false;
      const field = ["guestName", "guestEmail"].find((name) => name in errors);
      if (field)
        form.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    }
  }, [errors, phase]);
  useEffect(() => {
    if (conflict) dialog.current?.showModal();
  }, [conflict]);
  function closeConflict() {
    dialog.current?.close();
    setConflict(false);
    onRefused();
  }
  async function send(attempt: PendingAttempt<Context>) {
    if (sending.current) return;
    sending.current = true;
    setPhase("sending");
    setMessage("");
    setErrors({});
    try {
      const result = await sendBooking(attempt.key, attempt.payload.input);
      completeAttempt(
        storageName,
        result.type === "created"
          ? {
              name: confirmationName,
              value: { idempotencyKey: attempt.key, data: result.data },
            }
          : undefined,
      );
      setPending(undefined);
      setPhase("idle");
      if (result.type === "created") onConfirmed(result.data);
      else if (result.error.code === "SLOT_TAKEN") setConflict(true);
      else if (
        result.error.code === "TIME_UNAVAILABLE" ||
        result.error.code === "EVENT_TYPE_NOT_FOUND"
      )
        onRefused(result.error.message);
      else {
        setErrors(result.error.fieldErrors ?? { form: result.error.message });
        focusErrors.current = true;
        setMessage("Проверьте контакты");
      }
    } catch {
      setPhase("unknown");
    } finally {
      sending.current = false;
    }
  }
  function submit(event: React.SubmitEvent) {
    event.preventDefault();
    if (phase !== "idle" || !slot || sending.current) return;
    const input = {
      eventTypeId: eventType.id,
      startsAt: slot.startsAt,
      ...draft,
    };
    const invalid = schemaErrors("BookingDraft", normalizeBooking(input));
    const values = Object.fromEntries(
      Object.keys(invalid).map((name) => [
        name,
        name === "guestName"
          ? "Имя: от 1 до 100 символов, без переносов строк"
          : name === "guestEmail"
            ? "Укажите корректный email, не более 254 символов"
            : "Проверьте выбранное время",
      ]),
    );
    setErrors(values);
    setMessage("");
    if (Object.keys(values).length) {
      focusErrors.current = true;
      return;
    }
    try {
      const attempt = saveAttempt(storageName, { input, eventType, slot });
      setPending(attempt);
      void send(attempt);
    } catch {
      setMessage(
        "Не удалось сохранить отправку в этой вкладке. Разрешите sessionStorage и повторите подтверждение.",
      );
    }
  }
  const locked = phase !== "idle";
  useEffect(() => onLocked(locked), [locked, onLocked]);
  return (
    <section hidden={!active} className="booking-contacts owner-panel">
      <h2 ref={heading} tabIndex={-1}>
        Контакты
      </h2>
      {slot && <Summary eventType={eventType} slot={slot} />}
      <p>
        После подтверждения письмо на email не придёт. Сохраните детали с
        экрана.
      </p>
      <form ref={form} onSubmit={submit} noValidate>
        <label htmlFor="guest-name">Имя</label>
        <input
          id="guest-name"
          name="guestName"
          autoComplete="name"
          value={draft.guestName}
          disabled={locked}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              guestName: event.target.value,
            }));
            setErrors((current) => ({ ...current, guestName: "" }));
          }}
          aria-invalid={!!errors.guestName}
          aria-describedby="guest-name-error"
        />
        <p id="guest-name-error" className="field-error">
          {errors.guestName}
        </p>
        <label htmlFor="guest-email">Email</label>
        <input
          id="guest-email"
          name="guestEmail"
          type="email"
          autoComplete="email"
          value={draft.guestEmail}
          disabled={locked}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              guestEmail: event.target.value,
            }));
            setErrors((current) => ({ ...current, guestEmail: "" }));
          }}
          aria-invalid={!!errors.guestEmail}
          aria-describedby="guest-email-error"
        />
        <p id="guest-email-error" className="field-error">
          {errors.guestEmail}
        </p>
        {errors.form && <p role="alert">{errors.form}</p>}
        <div className="booking-actions">
          <button
            type="button"
            className="choice-button"
            disabled={locked}
            onClick={onBack}
          >
            Назад к дате и времени
          </button>
          <button
            type="submit"
            className="reload-button"
            disabled={locked || !slot}
          >
            Подтвердить бронирование
          </button>
        </div>
      </form>
      <div role={phase === "unknown" ? "alert" : "status"}>
        {message && <p>{message}</p>}
        {phase === "sending" && <p>Подтверждаем встречу…</p>}
        {phase === "unknown" && (
          <>
            <p>Не удалось узнать результат бронирования</p>
            <p>
              Бронирование могло быть сохранено. Повторите эту же попытку, чтобы
              узнать результат.
            </p>
            <button
              type="button"
              className="reload-button"
              onClick={() => pending && void send(pending)}
            >
              Повторить подтверждение
            </button>
          </>
        )}
      </div>
      <dialog
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            dialog.current?.querySelector("button")?.focus();
          }
        }}
        role="alertdialog"
        aria-labelledby="slot-conflict-title"
        onCancel={(event) => {
          event.preventDefault();
          closeConflict();
        }}
      >
        <h2 id="slot-conflict-title">Слот уже занят</h2>
        <p>Выберите другое время. Ваши контакты сохранены.</p>
        <button
          type="button"
          className="reload-button"
          autoFocus
          onClick={closeConflict}
        >
          Выбрать другое время
        </button>
      </dialog>
    </section>
  );
}
