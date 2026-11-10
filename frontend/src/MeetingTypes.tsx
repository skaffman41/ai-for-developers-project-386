import { useEffect, useState } from "react";
import type { EventType } from "@call-calendar/contract/types";
import { loadEventTypes } from "./api.ts";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; types: EventType[] };

export function MeetingTypes({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (type: EventType) => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadEventTypes(controller.signal).then(
      (types) => {
        if (!controller.signal.aborted) setState({ status: "loaded", types });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [revision]);
  function reload() {
    setState({ status: "loading" });
    setRevision((value) => value + 1);
  }
  return (
    <section
      className="meeting-types"
      aria-labelledby="types-heading"
      aria-busy={state.status === "loading"}
    >
      <h2 id="types-heading">Типы встреч</h2>
      <div
        className="types-announcement"
        role={state.status === "error" ? "alert" : "status"}
      >
        {state.status === "loading" && <p>Загружаем типы встреч…</p>}
        {state.status === "error" && (
          <p>Не удалось загрузить типы встреч. Попробуйте ещё раз.</p>
        )}
        {state.status === "loaded" && state.types.length === 0 && (
          <p>Типов встреч пока нет. Обновите список позже.</p>
        )}
        {state.status === "loaded" && state.types.length > 0 && (
          <p>Доступные форматы встречи с владельцем календаря.</p>
        )}
      </div>
      {state.status === "loaded" && state.types.length > 0 && (
        <ul className="type-list" aria-label="Типы встреч">
          {state.types.map((type) => (
            <li key={type.id} className="type-card">
              <span className="type-code">{type.displayCode}</span>
              <h3>{type.name}</h3>
              <p className="type-duration">{type.durationMinutes} мин.</p>
              <p className="type-description">
                {type.description ?? "Описание не указано"}
              </p>
              <button
                type="button"
                className="choice-button"
                aria-pressed={selectedId === type.id}
                onClick={() => onSelect(type)}
              >
                Выбрать {type.name}, {type.displayCode}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="reload-button"
        onClick={reload}
        disabled={state.status === "loading"}
      >
        {state.status === "error" ? "Повторить загрузку" : "Обновить список"}
      </button>
    </section>
  );
}
