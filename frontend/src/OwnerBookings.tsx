import { useEffect, useState } from "react";
import type {
  Booking,
  GetOwnerBookingsData,
} from "@call-calendar/contract/types";
import { loadOwnerBookings } from "./api.ts";
import { formatMoscowTime } from "./moscow-time.ts";

type Period = NonNullable<NonNullable<GetOwnerBookingsData["query"]>["period"]>;
const periods = {
  upcoming: "Предстоящие и текущие",
  past: "Прошедшие",
  all: "Все",
};
export function ownerTimestamp(value: string) {
  return new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}
function date(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function OwnerBookings({
  hasTypes,
  createType,
}: {
  hasTypes: boolean | undefined;
  createType: () => void;
}) {
  const [period, setPeriod] = useState<Period>("upcoming");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [loaded, setLoaded] = useState<{
    values: Booking[];
    asOf: string;
    period: Period;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    loadOwnerBookings(period, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setLoaded({ ...result, period });
        setStatus("loaded");
      },
      () => {
        if (!controller.signal.aborted) setStatus("error");
      },
    );
    return () => controller.abort();
  }, [period, revision]);
  return (
    <section
      className="owner-panel owner-bookings"
      aria-label="Список бронирований"
    >
      <div className="bookings-toolbar">
        <h2>Ваши бронирования</h2>
        <label htmlFor="owner-period">Период</label>
        <select
          id="owner-period"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value as Period);
            setStatus("loading");
          }}
        >
          {Object.entries(periods).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="reload-button"
          type="button"
          disabled={status === "loading"}
          onClick={() => {
            setStatus("loading");
            setRevision((value) => value + 1);
          }}
        >
          {status === "error"
            ? "Повторить загрузку бронирований"
            : "Обновить бронирования"}
        </button>
      </div>
      <div role={status === "error" ? "alert" : "status"}>
        {status === "loading" && (
          <p>
            {loaded
              ? "Обновляем бронирования… Прежние данные остаются видимыми."
              : "Загружаем бронирования…"}
          </p>
        )}
        {status === "error" && (
          <p>
            Не удалось загрузить бронирования.{" "}
            {loaded ? "Данные устарели." : "Попробуйте ещё раз."}
          </p>
        )}
        {loaded && (
          <p>
            Последняя загрузка:{" "}
            <time dateTime={loaded.asOf}>{ownerTimestamp(loaded.asOf)}</time>,
            Москва. Состояние встреч на момент загрузки.
          </p>
        )}
        {loaded && loaded.period !== period && (
          <p>Показаны данные периода «{periods[loaded.period]}».</p>
        )}
        {status === "loaded" && !loaded?.values.length && (
          <>
            {hasTypes === false ? (
              <>
                <p>
                  Типов встреч пока нет. Создайте первый тип, чтобы гости могли
                  записаться.
                </p>
                <button
                  type="button"
                  className="reload-button"
                  onClick={createType}
                >
                  Создать первый тип
                </button>
              </>
            ) : (
              <>
                <p>
                  {period === "upcoming"
                    ? "Предстоящих и текущих бронирований пока нет."
                    : period === "past"
                      ? "Прошедших бронирований пока нет."
                      : "Бронирований пока нет."}
                </p>
                <a className="home-link" href="/booking">
                  Открыть запись гостя
                </a>
              </>
            )}
          </>
        )}
      </div>
      <div aria-busy={status === "loading"}>
        {!!loaded?.values.length && (
          <ul className="booking-list" aria-label="Сохранённые бронирования">
            {loaded.values.map((booking) => {
              const state =
                Date.parse(booking.endsAt) <= Date.parse(loaded.asOf)
                  ? "Завершившаяся"
                  : Date.parse(booking.startsAt) <= Date.parse(loaded.asOf)
                    ? "Текущая"
                    : "Предстоящая";
              return (
                <li key={booking.id} className="booking-row">
                  <div>
                    <span className="booking-state">{state}</span>
                    <h3>{booking.eventType.name}</h3>
                    <p>
                      {booking.eventType.displayCode} ·{" "}
                      {booking.eventType.durationMinutes} мин.
                    </p>
                  </div>
                  <div>
                    <p>
                      <time dateTime={booking.startsAt}>
                        {date(booking.startsAt)}
                      </time>
                    </p>
                    <p className="booking-interval">
                      {formatMoscowTime(booking.startsAt)}–
                      {formatMoscowTime(booking.endsAt)}
                    </p>
                    {date(booking.startsAt) !== date(booking.endsAt) && (
                      <p>Окончание: {date(booking.endsAt)}</p>
                    )}
                    <p>Москва · Europe/Moscow</p>
                  </div>
                  <div>
                    <p className="guest-name">{booking.guestName}</p>
                    <a href={`mailto:${booking.guestEmail}`}>
                      {booking.guestEmail}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
