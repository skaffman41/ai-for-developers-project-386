import { useEffect, useRef, useState } from "react";
import type {
  Booking,
  Availability,
  EventType,
  Slot,
} from "@call-calendar/contract/types";
import { AvailabilityDateExpired, loadAvailability } from "./api.ts";
import {
  BookingContacts,
  BookingConfirmation,
  restoreBooking,
} from "./BookingContacts.tsx";
import { MeetingTypes } from "./MeetingTypes.tsx";
import "./guest-booking.css";

type AvailabilityState =
  | { key: string; status: "loading" | "error" }
  | { key: string; status: "loaded"; data: Availability };
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "full",
  }).format(new Date(`${date}T12:00:00Z`));
const formatTime = (instant: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
const formatSlot = (slot: Slot) =>
  `${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)}`;

function calendarDays(first: string, last: string) {
  const result: string[] = [];
  for (
    let day = Date.parse(`${first}T12:00:00Z`);
    day <= Date.parse(`${last}T12:00:00Z`);
    day += 86_400_000
  )
    result.push(new Date(day).toISOString().slice(0, 10));
  return result;
}

export function GuestBooking() {
  const [restored] = useState(restoreBooking);
  const [confirmation, setConfirmation] = useState<Booking | undefined>(
    restored.confirmation,
  );
  const [locked, setLocked] = useState(!!restored.pending);
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(restored.pending ? 3 : 1);
  const [type, setType] = useState<EventType | undefined>(
    restored.pending?.payload.eventType,
  );
  const [date, setDate] = useState<string | undefined>(
    restored.pending?.payload.slot.startsAt.slice(0, 10),
  );
  const [slot, setSlot] = useState<Slot | undefined>(
    restored.pending?.payload.slot,
  );
  const [query, setQuery] = useState<{ date?: string; revision: number }>({
    revision: 0,
  });
  const [state, setState] = useState<AvailabilityState>({
    key: "",
    status: "loading",
  });
  const [bounds, setBounds] = useState<{
    firstDate: string;
    lastDate: string;
  }>();
  const heading = useRef<HTMLHeadingElement>(null);
  const typeStep = useRef<HTMLButtonElement>(null);
  const previousStep = useRef(step);
  const requestKey = `${type?.id}:${query.date ?? "today"}:${query.revision}`;
  const active =
    state.key === requestKey ? state : { status: "loading" as const };
  useEffect(() => {
    if (step !== 2 || !type) return;
    const controller = new AbortController();
    const eventTypeId = type.id;
    async function readAvailability() {
      try {
        return await loadAvailability(
          eventTypeId,
          query.date,
          controller.signal,
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          query.date === undefined ||
          !(error instanceof AvailabilityDateExpired)
        )
          throw error;
        // Only the server can invalidate a retained date or supply new bounds.
        // Clear expired context before the default-date read, including on error,
        // so an explicit retry never repeats yesterday's request.
        setDate(undefined);
        setSlot(undefined);
        setBounds(undefined);
        return loadAvailability(eventTypeId, undefined, controller.signal);
      }
    }
    readAvailability().then(
      (data) => {
        if (controller.signal.aborted) return;
        setState({ key: requestKey, status: "loaded", data });
        setBounds({ firstDate: data.firstDate, lastDate: data.lastDate });
        setDate(data.date);
        setSlot((previous) =>
          data.slots.find(
            (item) =>
              item.startsAt === previous?.startsAt &&
              item.endsAt === previous.endsAt,
          ),
        );
      },
      () => {
        if (!controller.signal.aborted)
          setState({ key: requestKey, status: "error" });
      },
    );
    return () => controller.abort();
  }, [type, query, step, requestKey]);
  useEffect(() => {
    if (step === 2) heading.current?.focus();
    else if (step === 1 && previousStep.current !== step)
      typeStep.current?.focus();
    previousStep.current = step;
  }, [step]);
  function openTime() {
    setQuery((previous) => ({ date, revision: previous.revision + 1 }));
    setStep(2);
  }
  function selectType(next: EventType) {
    if (next.id !== type?.id) setSlot(undefined);
    setType(next);
  }
  function selectDate(next: string) {
    if (next !== date) setSlot(undefined);
    setDate(next);
    setQuery((previous) => ({ date: next, revision: previous.revision + 1 }));
  }
  const visibleSlot = active.status === "loaded" ? slot : undefined;
  if (restored.failed)
    return (
      <p role="alert">
        Не удалось прочитать сохранённую отправку в этой вкладке. Восстановите
        доступ к sessionStorage и обновите страницу.
      </p>
    );
  if (confirmation) return <BookingConfirmation booking={confirmation} />;
  return (
    <div className="guest-booking">
      <nav className="booking-steps" aria-label="Шаги записи">
        <button
          ref={typeStep}
          type="button"
          aria-current={step === 1 ? "step" : undefined}
          disabled={locked}
          onClick={() => setStep(1)}
        >
          1. Тип встречи
        </button>
        <button
          type="button"
          aria-current={step === 2 ? "step" : undefined}
          disabled={!type || locked}
          onClick={openTime}
        >
          2. Дата и время
        </button>
        <button
          type="button"
          aria-current={step === 3 ? "step" : undefined}
          disabled={!visibleSlot || locked}
          onClick={() => setStep(3)}
        >
          3. Контакты
        </button>
      </nav>
      <div hidden={step !== 1}>
        <MeetingTypes selectedId={type?.id} onSelect={selectType} />
        <button
          type="button"
          className="reload-button"
          disabled={!type}
          onClick={openTime}
        >
          Выбрать дату и время
        </button>
      </div>
      {notice && <p role="alert">{notice}</p>}
      {step === 2 && type && (
        <section
          className="availability"
          aria-labelledby="availability-heading"
          aria-busy={active.status === "loading"}
        >
          <h2 id="availability-heading" tabIndex={-1} ref={heading}>
            Дата и время
          </h2>
          <p>
            {type.name} · {type.durationMinutes} мин. · {type.displayCode}
          </p>
          <p className="time-zone">Время по Москве · Europe/Moscow</p>
          {bounds && (
            <div className="date-grid" role="group" aria-label="Выберите дату">
              {calendarDays(bounds.firstDate, bounds.lastDate).map((day) => {
                const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
                return (
                  <button
                    key={day}
                    type="button"
                    className="choice-button date-choice"
                    aria-label={formatDate(day)}
                    aria-pressed={day === date}
                    disabled={weekday === 0 || weekday === 6}
                    onClick={() => selectDate(day)}
                  >
                    <span>
                      {new Intl.DateTimeFormat("ru-RU", {
                        timeZone: "Europe/Moscow",
                        weekday: "short",
                      }).format(new Date(`${day}T12:00:00Z`))}
                    </span>
                    <strong>
                      {day.slice(8)}.{day.slice(5, 7)}
                    </strong>
                  </button>
                );
              })}
            </div>
          )}
          <div
            role={active.status === "error" ? "alert" : "status"}
            className="availability-message"
          >
            {active.status === "loading" && <p>Загружаем свободное время…</p>}
            {active.status === "error" && (
              <p>Не удалось загрузить свободное время. Попробуйте ещё раз.</p>
            )}
            {active.status === "loaded" && (
              <p>
                {formatDate(active.data.date)}
                {active.data.slots.length === 0
                  ? ": свободного времени нет. Выберите другую дату или тип встречи."
                  : ": выберите свободный интервал."}
              </p>
            )}
          </div>
          {active.status === "loaded" && active.data.slots.length > 0 && (
            <div
              role="group"
              aria-label="Свободные интервалы"
              className="slot-grid"
            >
              {active.data.slots.map((item) => (
                <button
                  key={item.startsAt}
                  type="button"
                  className="choice-button"
                  aria-pressed={slot?.startsAt === item.startsAt}
                  onClick={() => setSlot(item)}
                >
                  {formatSlot(item)}
                </button>
              ))}
            </div>
          )}
          {active.status === "error" && (
            <button type="button" className="reload-button" onClick={openTime}>
              Повторить загрузку времени
            </button>
          )}
          {visibleSlot && (
            <p className="selected-time" role="status">
              Выбрано: {formatDate(date!)} · {formatSlot(visibleSlot)} ·
              Europe/Moscow
            </p>
          )}
          <div className="booking-actions">
            <button
              type="button"
              className="choice-button"
              onClick={() => setStep(1)}
            >
              Назад к типам встреч
            </button>
            <button
              type="button"
              className="reload-button"
              disabled={!visibleSlot}
              onClick={() => setStep(3)}
            >
              Указать контакты
            </button>
          </div>
        </section>
      )}
      {type && (
        <BookingContacts
          eventType={type}
          slot={slot}
          active={step === 3}
          restored={restored}
          onBack={openTime}
          onLocked={setLocked}
          onConfirmed={setConfirmation}
          onRefused={(message) => {
            setSlot(undefined);
            setNotice(message ?? "");
            openTime();
          }}
        />
      )}
    </div>
  );
}
