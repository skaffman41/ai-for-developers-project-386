# Agent instructions

Учебный проект Hexlet «Календарь звонков».

- Сохраняй `.github/workflows/hexlet-check.yml` без изменений.
- Для workflow используй глобальные Matt Pocock Skills. Подготовка и проверка — [skills.md](docs/agents/skills.md); OpenSpec не устанавливай.

## Команды разработки

Выполняй из корня после `mise install --locked`, `mise run setup` и `mise run browser:install`
(на Linux добавь `-- --with-deps` к установке браузера):

| Команда          | Назначение                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| `mise run dev`   | Запуск frontend и backend; Ctrl+C останавливает оба процесса.                        |
| `mise run test`  | Сборка и полный HTTP smoke в Vitest.                                                 |
| `mise run lint`  | ESLint без исправлений; предупреждения считаются ошибкой.                            |
| `mise run check` | Версии, линтер, форматирование, типы, сборка, HTTP smoke, Playwright и валидация hk. |

Остальные команды и установка локальных хуков описаны в [README](README.md#использование).

## Development workflow

Перед подготовкой плана, реализацией или коммитом читай [development-workflow.md](docs/agents/development-workflow.md).

- Согласованный план фиксируй отдельным коммитом до реализации.
- `$implement <issue>` выполняет один тикет; `$implement-spec <spec>` — весь согласованный граф через отдельные worktree. Оба режима разрешают назначения Issues, отчёты и отдельный коммит каждой задачи.
- Каждый новый коммит реализации оформляй по Conventional Commits: `type(scope): description (#NN)`, scope необязателен. Ссылка на выполняемый тикет обязательна, например `feat: запись на свободный слот (#12)`; в графе каждый коммит ссылается на собственную задачу.
- Push, создание PR и merge в `main` требуют отдельных явных команд. Локальные результаты реализации остаются открытыми в Issues до merge.
- Перед разрешённой публикацией пройди [подготовку к push](docs/agents/skills.md#перед-разрешённой-публикацией): Git-авторизация и необходимые права проверяются отдельно от доступа к Issues.
- Сохраняй чужие изменения; независимый code-review применяй к существенным изменениям по правилам workflow.

## API-контракт и генерация

Единственный исходник HTTP-контракта — `contract/main.tsp`; настройки компилятора TypeSpec — `contract/tspconfig.yaml`. Изменяй контрактные данные в TypeSpec, затем выполняй всю цепочку TypeSpec → OpenAPI → производные командой `mise run api:generate`.

Генерируемые пути:

- `contract/openapi.json` — OpenAPI 3.1;
- `contract/API.generated.md` — документация API;
- весь `contract/src/generated/` — SDK, клиентские модели, серверные типы, схемы проверки, реестр операций и вспомогательные файлы клиента.

Ручное изменение этих производных запрещено. Сохраняй их в Git вместе с изменением исходника. `mise run api:check` независимо генерирует ожидаемый набор и проверяет расхождения без перезаписи сохранённых файлов; он входит в обязательную общую проверку `mise run check`.

## Tool Failure Recovery

После первой технической ошибки читай [tool-recovery.md](docs/agents/tool-recovery.md). Установи причину и попробуй безопасные альтернативы; блокировку фиксируй после исчерпания разумных маршрутов.

## Agent skills

### Issue tracker

Все новые карты, спецификации и задачи веди в GitHub Issues репозитория `skaffman41/ai-for-developers-project-386`. Перед разрешением номера, URL или старого ID, чтением и записью Issues читай [issue-tracker.md](docs/agents/issue-tracker.md). `.scratch/` — неизменяемый исторический архив; соответствия находятся в [tracker-migration.md](docs/agents/tracker-migration.md).

### Triage labels

Перед классификацией задачи и сменой роли читай [triage-labels.md](docs/agents/triage-labels.md). Категория, triage, назначение и завершение имеют разные значения.

### Domain docs

Используется single-context: корневой `GLOSSARY.md` и `docs/adr/`. Перед исследованием проекта читай [domain.md](docs/agents/domain.md).
