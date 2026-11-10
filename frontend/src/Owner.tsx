import { normalizeEventType } from "@call-calendar/contract/event-types";
import { useEffect, useRef, useState } from "react";
import type {
  CreateEventTypeInput,
  EventType,
} from "@call-calendar/contract/types";
import {
  schemaErrors,
  validRequestBody,
} from "@call-calendar/contract/validation";
import { loadOwnerEventTypes, sendEventType } from "./api.ts";
import { OwnerBookings, ownerTimestamp } from "./OwnerBookings.tsx";
import { completeAttempt, readAttempt, saveAttempt } from "./attempts.ts";
import type { PendingAttempt } from "./attempts.ts";

const storageName = "call-calendar:createEventType";
const empty = { name: "", durationMinutes: "30", description: "" };
function restore() {
  try {
    return {
      pending: readAttempt<CreateEventTypeInput>(storageName, (value) =>
        Boolean(validRequestBody("createEventType", value)),
      ),
      failed: false,
    };
  } catch {
    return { pending: undefined, failed: true };
  }
}
function draftErrors(raw: CreateEventTypeInput) {
  const errors = schemaErrors("EventTypeDraft", normalizeEventType(raw));
  const messages: Record<string, string> = {
    name: "Название: от 1 до 100 символов, без переносов строк",
    durationMinutes: "Длительность: целое число от 1 до 540 минут",
    description: "Описание: не более 2000 символов",
  };
  return Object.fromEntries(
    Object.keys(errors).map((name) => [
      name,
      messages[name] ?? "Проверьте поля формы",
    ]),
  );
}

export function Owner() {
  const [tab, setTab] = useState<"bookings" | "types">("bookings");
  const [restored] = useState(restore);
  const [pending, setPending] = useState<
    PendingAttempt<CreateEventTypeInput> | undefined
  >(restored.pending);
  const [draft, setDraft] = useState(() =>
    restored.pending
      ? {
          name: restored.pending.payload.name,
          durationMinutes: String(restored.pending.payload.durationMinutes),
          description: restored.pending.payload.description ?? "",
        }
      : empty,
  );
  const [phase, setPhase] = useState<"idle" | "sending" | "unknown">(
    restored.pending ? "unknown" : "idle",
  );
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<EventType[]>([]);
  const [listStatus, setListStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  const [loadedAt, setLoadedAt] = useState<string>();
  const created = useRef<EventType[]>([]);
  const sending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const needsFocus = useRef(false);
  useEffect(() => {
    if (tab === "types" && phase === "idle" && needsFocus.current) {
      needsFocus.current = false;
      focusError(errors);
    }
  }, [errors, phase, tab]);
  useEffect(() => {
    const controller = new AbortController();
    loadOwnerEventTypes(controller.signal).then(
      ({ values, asOf }) => {
        if (controller.signal.aborted) return;
        setTypes([
          ...created.current.filter(
            (value) => !values.some((type) => type.id === value.id),
          ),
          ...values,
        ]);
        setListStatus("loaded");
        setLoadedAt(asOf);
      },
      () => {
        if (!controller.signal.aborted) setListStatus("error");
      },
    );
    return () => controller.abort();
  }, [revision]);
  function focusError(values: Record<string, string>) {
    const name = ["name", "durationMinutes", "description"].find(
      (key) => key in values,
    );
    if (name)
      form.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
    else form.current?.focus();
  }
  async function send(attempt: PendingAttempt<CreateEventTypeInput>) {
    if (sending.current) return;
    sending.current = true;
    setPhase("sending");
    setMessage("");
    setErrors({});
    try {
      const result = await sendEventType(attempt.key, attempt.payload);
      // A failed local completion retains the original context and locked form.
      completeAttempt(storageName);
      setPending(undefined);
      setPhase("idle");
      if (result.type === "created") {
        if (!created.current.some((value) => value.id === result.data.id))
          created.current = [result.data, ...created.current];
        // A replay can identify an older type already loaded in server order.
        // Only a previously unseen entity belongs at the front of the local list.
        setTypes((values) =>
          values.some((value) => value.id === result.data.id)
            ? values
            : [result.data, ...values],
        );
        setDraft(empty);
        setMessage("Тип встречи создан");
      } else {
        const values = result.error.fieldErrors ?? {
          form: result.error.message,
        };
        needsFocus.current = true;
        setErrors(values);
        setMessage("Проверьте поля типа встречи");
      }
    } catch {
      setPhase("unknown");
    } finally {
      sending.current = false;
    }
  }
  function submit(event: React.SubmitEvent) {
    event.preventDefault();
    if (phase !== "idle" || restored.failed || sending.current) return;
    const payload = {
      name: draft.name,
      durationMinutes: Number(draft.durationMinutes),
      description: draft.description,
    };
    const values = draftErrors(payload);
    setErrors(values);
    setMessage("");
    if (Object.keys(values).length) {
      needsFocus.current = true;
      return;
    }
    try {
      const attempt = saveAttempt(storageName, payload);
      setPending(attempt);
      void send(attempt);
    } catch {
      setMessage(
        "Не удалось сохранить отправку в этой вкладке. Разрешите sessionStorage и повторите создание.",
      );
    }
  }
  function change(name: keyof typeof empty, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== name),
      ),
    );
  }
  const locked = phase !== "idle" || restored.failed;
  return (
    <main className="owner-main">
      <p className="eyebrow">Для ваших встреч</p>
      <h1>Календарь владельца</h1>
      <div className="owner-heading">
        <div
          className="owner-tabs"
          role="tablist"
          aria-label="Раздел календаря"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "bookings"
                : event.key === "End"
                  ? "types"
                  : tab === "types"
                    ? "bookings"
                    : "types";
            setTab(next);
            document.getElementById(`owner-tab-${next}`)?.focus();
          }}
        >
          {(
            [
              ["bookings", "Бронирования"],
              ["types", "Типы встреч"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              id={`owner-tab-${value}`}
              role="tab"
              type="button"
              aria-selected={tab === value}
              aria-controls={`owner-panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <a className="home-link" href="/booking">
          Открыть запись гостя ↗
        </a>
      </div>
      <div
        id="owner-panel-bookings"
        role="tabpanel"
        aria-labelledby="owner-tab-bookings"
        tabIndex={0}
        hidden={tab !== "bookings"}
      >
        <OwnerBookings
          hasTypes={
            types.length ? true : listStatus === "loaded" ? false : undefined
          }
          createType={() => {
            setTab("types");
            requestAnimationFrame(() =>
              document.getElementById("type-name")?.focus(),
            );
          }}
        />
      </div>
      <div
        id="owner-panel-types"
        role="tabpanel"
        aria-labelledby="owner-tab-types"
        tabIndex={0}
        hidden={tab !== "types"}
        className="owner-columns"
      >
        <section className="owner-panel" aria-label="Создание типа встречи">
          <h2>Новый тип встречи</h2>
          <p>
            После создания изменить или удалить тип пока нельзя. Проверьте
            данные перед отправкой.
          </p>
          <form ref={form} onSubmit={submit} noValidate tabIndex={-1}>
            <label htmlFor="type-name">Название</label>
            <input
              id="type-name"
              name="name"
              value={draft.name}
              onChange={(event) => change("name", event.target.value)}
              disabled={locked}
              aria-invalid={!!errors.name}
              aria-describedby="type-name-hint type-name-error"
            />
            <small id="type-name-hint">От 1 до 100 символов, одна строка</small>
            <p className="field-error" id="type-name-error">
              {errors.name}
            </p>
            <label htmlFor="type-duration">Длительность, минут</label>
            <input
              id="type-duration"
              name="durationMinutes"
              type="number"
              min="1"
              max="540"
              step="1"
              value={draft.durationMinutes}
              onChange={(event) =>
                change("durationMinutes", event.target.value)
              }
              disabled={locked}
              aria-invalid={!!errors.durationMinutes}
              aria-describedby="type-duration-hint type-duration-error"
            />
            <small id="type-duration-hint">Целое число от 1 до 540</small>
            <p className="field-error" id="type-duration-error">
              {errors.durationMinutes}
            </p>
            <label htmlFor="type-description">Описание</label>
            <textarea
              id="type-description"
              name="description"
              rows={4}
              value={draft.description}
              onChange={(event) => change("description", event.target.value)}
              disabled={locked}
              aria-invalid={!!errors.description}
              aria-describedby="type-description-hint type-description-error"
            />
            <small id="type-description-hint">
              Необязательно, до 2000 символов
            </small>
            <p className="field-error" id="type-description-error">
              {errors.description}
            </p>
            {errors.form && <p role="alert">{errors.form}</p>}
            <button className="reload-button" type="submit" disabled={locked}>
              Создать тип
            </button>
          </form>
          <div
            role={phase === "unknown" || restored.failed ? "alert" : "status"}
          >
            {message && <p>{message}</p>}
            {restored.failed && (
              <p>Не удалось прочитать сохранённую отправку в этой вкладке.</p>
            )}
            {phase === "sending" && <p>Создаём тип встречи…</p>}
            {phase === "unknown" && (
              <>
                <p>Не удалось узнать результат создания типа</p>
                <button
                  type="button"
                  className="reload-button"
                  onClick={() => pending && void send(pending)}
                >
                  Повторить создание
                </button>
              </>
            )}
          </div>
        </section>
        <section
          className="owner-panel"
          aria-label="Список типов встреч"
          aria-busy={listStatus === "loading"}
        >
          <h2>Ваши типы</h2>
          <div role={listStatus === "error" ? "alert" : "status"}>
            {listStatus === "loading" && <p>Загружаем типы встреч…</p>}
            {listStatus === "error" && (
              <p>
                Не удалось загрузить типы встреч.
                {loadedAt ? " Данные устарели." : " Попробуйте ещё раз."}
              </p>
            )}
            {listStatus === "loaded" && !types.length && (
              <p>Типов встреч пока нет. Создайте первый тип.</p>
            )}
            {loadedAt && (
              <p>
                Последняя загрузка:{" "}
                <time dateTime={loadedAt}>{ownerTimestamp(loadedAt)}</time>,
                Москва
              </p>
            )}
          </div>
          <button
            type="button"
            className="reload-button"
            disabled={listStatus === "loading"}
            onClick={() => {
              setListStatus("loading");
              setRevision((value) => value + 1);
            }}
          >
            {listStatus === "error" ? "Повторить загрузку" : "Обновить список"}
          </button>
          {!!types.length && (
            <ul className="type-list" aria-label="Типы встреч">
              {types.map((type) => (
                <li className="type-card" key={type.id}>
                  <span className="type-code">{type.displayCode}</span>
                  <h3>{type.name}</h3>
                  <p className="type-duration">{type.durationMinutes} мин.</p>
                  <p className="type-description">
                    {type.description ?? "Описание не указано"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
