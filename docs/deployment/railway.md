# Подготовка ручной выкладки на Railway через MCP

Активный маршрут [плана v2 #55](../plans/step-7-render-free/v2/spec.md) — один
Docker-сервис Railway в пределах бесплатных Free/Trial-кредитов, бюджет 0 ₽.
Подготовка #57 не создаёт проект, сервис или домен и не запускает деплой.
Фактическая публикация относится к #58 после отдельно разрешённого включения
проверенной версии в `main` и явной команды выкладки. Файлы в Git ничего не применяют.

## Подключение и авторизация

Предпочтительный способ — официальный Railway plugin: установите его и завершите
вход в Railway в браузере, выбрав нужный аккаунт и доступные проекты/workspace.
В этом запуске пользователь уже подтвердил установку и авторизацию; повторное
подключение не требуется. OAuth MCP и доступ Railway к GitHub проверяются отдельно.
[Официальный MCP](https://docs.railway.com/ai/mcp-server).

Для воспроизведения в отдельном окружении без плагина используется официальный
hosted endpoint `https://mcp.railway.com`. В доверенном checkout добавьте секцию из
[безопасного шаблона](../../.codex/config.toml.example) в `.codex/config.toml`,
сохранив существующие настройки. Из корня проекта выполните:

```sh
codex mcp login railway
codex mcp list
```

Завершите OAuth в браузере. Учётные данные остаются в пользовательском хранилище
клиента; `.codex/config.toml` игнорируется Git. Не помещайте credential-файлы,
токены, OAuth-сессии или `CODEX_HOME` в checkout. Шаблон ограничивает инструменты
клиента чтением, но не меняет права аккаунта. Используйте одно подключение,
чтобы не смешать аккаунты. [Настройки Codex MCP](https://developers.openai.com/codex/mcp/).

## Реальная проверка без создания ресурсов

Сначала прочитайте переданные подключением описания и схемы полного каталога
инструментов: названия, обязательные параметры, идентификаторы контекста,
ограничения и побочные эффекты. Наличие инструмента не разрешает его выполнение.
Для прямого шаблона сохраните `enabled_tools` вне Git, временно удалите весь этот
ключ и перезапустите клиент для чтения каталога. Не вызывайте операции записи.
Затем восстановите список из шаблона и перезапустите клиент; `codex mcp get railway
--json` должен показать восстановленный фильтр. Отсутствие инструмента в allowlist
не доказывает его отсутствия на сервере. Плагин может предоставлять другой каталог.

Фактический плагин 2026-11-11 предоставил прямые инструменты. Ниже указаны суффиксы
их полных имён `mcp__codex_apps__railway_<суффикс>` и значимые параметры схем:

| Инструмент                                   | Параметры и поведение                                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `whoami`, `list_workspaces`, `list_projects` | Читают аккаунт, доступные workspace и проекты.                                                                                                                                            |
| `list_services`                              | `projectId`; возвращает сервисы и environment IDs существующего проекта.                                                                                                                  |
| `create_project`                             | `name`, явный `workspaceId`, `defaultEnvironmentName: "production"`, `prDeploys: false`, `isPublic: false`; создание только в #58.                                                        |
| `create_service`                             | `projectId`, `environmentId`, `name`, `staged: true`, без `image`; пустой сервис в staged patch, без запущенного экземпляра до применения.                                                |
| `connect_service_source`                     | `projectId`, `serviceId`, `environmentId`, `repo`, `branch`, `commitSha`, `staged: true`; исходники не собираются до применения patch.                                                    |
| `update_service`                             | `projectId`, `serviceId`, `environmentId`, `staged: true`, `dockerfilePath`, `healthcheckPath`, `regions: {<region>: {numReplicas: 1}}`, при необходимости `limits` и `sleepApplication`. |
| `get_staged_changes`                         | `projectId`, `environmentId`; чтение **всего** patch: ресурсы, поля до/после, destructive-флаг и состояние STAGED/APPLYING.                                                               |
| `describe_service`, `get_service_config`     | `projectId`, `serviceId`, явный `environmentId`; первое показывает конфигурацию с patch, второе разделяет live и staged.                                                                  |
| `accept_deploy`                              | `environmentId`, необязательный `commitMessage`; применяет все staged changes среды и запускает выкладку. Нужна явная команда на deploy.                                                  |
| `generate_domain`                            | `projectId`, `serviceId`, `environmentId`, без `domain` для адреса Railway; публичная сеть меняется сразу.                                                                                |
| `list_deployments`                           | `projectId`, `serviceId`, `environmentId`; статус, `meta.commitHash`/branch, время и URL.                                                                                                 |
| `redeploy`                                   | Повторяет существующий deployment; не выбирает новый commit `main`.                                                                                                                       |

Сначала выполните только чтение аккаунта, workspace и проектов. Если выбранный
проект существует, прочитайте его сервисы с реальными параметрами схемы. При пустом
списке проектов сохраните успешный пустой ответ, не создавая проект ради проверки.
Запишите время UTC, операции, контекст, итог и безопасные поля ответа. Статус
подключения и документация не заменяют успешный MCP-read.

Этот каталог шире краткого списка на странице hosted MCP. Прямые инструменты
позволяют подготовить staged source/config без Railway Agent; схема не доказывает
успех будущего создания или сборки. Agent не нужен в выбранном маршруте.

## Бесплатный лимит и доступ к исходникам

До создания ресурсов отдельно прочитайте в аккаунте тариф, остаток и срок
бесплатных кредитов, ограничения Trial/Free и применимые лимиты расходов.
Начальный Trial по документации — $5 на срок до 30 дней; Free — $1 в месяц
без переноса остатка. При нехватке кредитов, требовании платного плана или карты
сохраните блокировку. Платные подписки, покупка кредитов, том и внешняя БД не разрешены.
[Free Trial](https://docs.railway.com/pricing/free-trial),
[тарифы](https://docs.railway.com/pricing/plans).

2026-11-11 в выбранном личном workspace `skaffman41's Projects` UI Dashboard показал
**TRIAL, 30 days or $5.00 left**, а Usage — **Credits Available $5.00**, Current Usage,
Credits Used и Current Bill **$0.00**. Trial Plan указывает 1 GB RAM, 2 vCPU и 1 GB Disk.
Это подтверждает текущий бесплатный остаток; успешное создание/запуск ещё не проверены.
Compute и Railway Agent учитываются раздельно; платный Agent в этом маршруте не вызывается.
[Лимиты расходов](https://docs.railway.com/pricing/cost-control#compute-vs-agent-usage-limits).

В Railway отдельно проверьте доступ к `skaffman41/ai-for-developers-project-386`
и ветке `main`, без подтверждения создания сервиса. Успех `gh`, OAuth MCP
и список проектов не подтверждают Railway → GitHub. Для GitHub source используется
Railway GitHub App. [Инструкция source](https://docs.railway.com/services#deploying-from-a-github-repo)
ссылается на [официальную форму Railway App](https://github.com/apps/railway-app/installations/new).

2026-11-11 первоначально список Railway New → GitHub Repository был пуст.
По отдельному подтверждению пользователя завершена браузерная установка Railway App
в режиме **Only select repositories** для `skaffman41/ai-for-developers-project-386`.
Форма запрашивала чтение metadata, чтение/запись actions, administration, checks,
code, commit statuses, deployments, pull requests и workflows, а также чтение email
аккаунта. Пользователь завершил GitHub sudo re-auth сам; пароли и коды в чат
не передавались. После возврата в Railway тот же репозиторий появился в списке.

Видимость репозитория подтверждена **со стороны Railway**. Отдельный GitHub API-read
подтвердил публичный репозиторий, `default_branch: main` и существование `main` с SHA
`403a3c2004f872873aee0e3815f7ac8f47d8abb0`. Вывод о доступности этой ветки для Railway
основан на разрешении GitHub App на code всего выбранного репозитория и его реальной
видимости в Railway. Это preflight до создания ресурсов; отдельное перечисление
веток, clone или build **через Railway** не выполнялись. В списке Railway нет
отдельного branch picker, tile репозитория не выбран, поскольку это может создать ресурс.

Перед выкладкой повторно сверяются выбранный SHA удалённого `main` и его соответствие
принятому локальному результату; источник закрепляется на нём, clone/build проверяются
в #58. Текущая локальная Docker-версия ещё не включена в указанный удалённый `main`.

## Настройки будущего сервиса

Это воспроизводимое описание настроек для сверки с MCP, не применяемый файл IaC:

| Настройка        | Требуемое значение                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Источник         | `skaffman41/ai-for-developers-project-386`, `main`, выбранный опубликованный SHA.                     |
| Сборка           | Корневой `Dockerfile`, контекст корня; без отдельного build/start override.                           |
| Запуск           | `CMD` образа: один Node/Fastify; frontend и API вместе, `HOST=0.0.0.0`.                               |
| Порт             | Выданный Railway `PORT`, без фиксированного переопределения в настройках сервиса.                     |
| Healthcheck      | `/health`; при выкладке Railway ожидает ответ `2xx`.                                                  |
| Масштаб          | Одна replica в одном выбранном регионе, в том числе на Trial.                                         |
| SQLite           | Подготовленный сборкой `/app/data/calendar.sqlite`; без volume, внешней БД и дополнительных сервисов. |
| Публикация       | Railway-provided HTTPS domain; создание домена только в рамках явно разрешённой выкладки.             |
| Обновления и сон | Source закреплён через `commitSha`; push не запускает выкладку. Serverless пока не выбран.            |

Существующий [Dockerfile](../../Dockerfile) уже подготавливает пустую SQLite
и задаёт команду запуска. Новые сервисы не поддерживают устаревшие `railway.json`
и `railway.toml`; они не добавляются. IaC `.railway/railway.ts` — отдельный механизм
plan/apply через CLI, не автоматически читаемый deploy-файл; для одного сервиса
дополнительные SDK и CLI сейчас не нужны.
[Dockerfile](https://docs.railway.com/builds/dockerfiles),
[Healthchecks](https://docs.railway.com/deployments/healthchecks),
[актуальная IaC](https://docs.railway.com/infrastructure-as-code).

## Маршрут первой выкладки и ручных обновлений

Маршрут подтверждён схемами прямых MCP-инструментов; выполнение записи ещё не
проверялось. `connect_service_source` с `commitSha` закрепляет источник на одном
commit и прекращает деплои по push в ветку. Отдельного параметра `autodeploy: false`
в этих схемах нет: инструкция использует проверяемое закрепление source и не
объявляет отдельный переключатель изменённым. **При каждом обновлении передавайте
`commitSha` заново**: подключение без него возвращает следование ветке.

После разрешённой авторизации GitHub, отдельной команды на выкладку и включения
проверенной версии в удалённый `main`:

1. Повторно прочитайте аккаунт, workspace, бесплатный остаток и source-доступ.
   Сверьте точный SHA `main`, Dockerfile и принятую локальную версию. Прочитайте
   существующие ресурсы; при нескольких workspace пользователь выбирает целевой.
2. Только в рамках выкладки создайте `create_project` с явным workspace,
   `defaultEnvironmentName: "production"`, `prDeploys: false`, `isPublic: false`.
   Сохраните `projectId`/`environmentId`; это уже запись, не безопасный просмотр.
3. Создайте **пустой** `create_service` с `staged: true`, явными project/environment,
   без image. Затем `connect_service_source` в той же среде: `staged: true`,
   `repo: "skaffman41/ai-for-developers-project-386"`, `branch: "main"`,
   `commitSha: "<проверенный опубликованный SHA main>"`. Без `staged: true`
   подключение source применилось бы сразу ко всем средам и могло запустить сборку.
4. Через `update_service` с `staged: true` и теми же ID задайте
   `dockerfilePath: "Dockerfile"`, `healthcheckPath: "/health"` и `regions` с одной
   replica ровно в одном поддерживаемом регионе. Не задавайте build/start override,
   PORT, том или внешнюю БД. Прочитайте будущую конфигурацию через `describe_service`
   и живую отдельно через `get_service_config`; при staged-create она ещё пуста.
5. Вызовите `get_staged_changes` и проверьте **весь** patch среды: один нужный сервис,
   pinned source, Docker, healthcheck, одна replica, без чужих изменений/удалений,
   дополнительных ресурсов, volume и БД. Если patch уже APPLYING, дождитесь завершения.
   После предъявления конкретного результата примените `accept_deploy` только в
   рамках явной команды выкладки; он коммитит все staged changes среды.
6. `generate_domain` без `domain` создаёт Railway HTTPS-адрес. Это отдельная
   немедленная запись публичной сети, не staged preview; выполняйте её только
   в рамках разрешённой публикации и сохраните результат.
7. Через `get_service_config` и `describe_service` после применения проверьте живой
   `source.commitSha`, совпадение с выбранным `main`, один экземпляр и отсутствие
   volume/БД. `list_deployments` должен подтвердить успешный статус и
   `meta.commitHash` именно этого commit. Сохраните ID, время UTC, хеш настроек,
   URL и результаты внешней HTTP/браузерной приёмки #58.

Для последующего обновления пропустите создание проекта/сервиса, прочитайте
живую конфигурацию и весь patch, затем повторите staged source с **новым**
проверенным `commitSha`, нужные staged настройки, просмотр и явное применение.
Повторно проверьте pin и deployment SHA. `redeploy` повторяет прежний deployment
и не заменяет выбор нового `main`. Локальный diff и push не меняют закреплённый
источник; снятие pin не входит в этот маршрут. Успех операции платформы не заменяет
публичную приёмку. [GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys),
[deployment actions](https://docs.railway.com/deployments/deployment-actions#redeploy),
[staged changes](https://docs.railway.com/deployments/staged-changes).

## Ограничения стенда и состояние проверки

Используйте вымышленные имена/email: раздел владельца календаря открыт без входа.
Без volume изменения SQLite теряются при замене контейнера и новом деплое;
сохранение после сна или перезапуска не обещается. Атомарность и повторы действуют
в пределах текущей БД. Локальные гарантии постоянного хранения сохраняются по
[ADR 0003](../adr/0003-booking-storage.md); исключение стенда —
[ADR 0006](../adr/0006-public-demo-deployment.md).

Railway Free/Trial ограничены кредитами и ресурсами, поэтому доступность на весь
месяц не гарантируется. Если будет включён Serverless, отдельно зафиксируйте его
условия сна и фактическую задержку запуска. Значения Render «15 минут / около
минуты» к Railway не относятся. [Serverless](https://docs.railway.com/pricing/cost-control#enabling-serverless).

2026-11-11 реальное MCP-чтение успешно: аккаунт `skaffman41` REGISTERED,
`whoami` и `list_projects` без ошибок, список проектов пуст. `list_workspaces`
подтвердил один личный workspace `skaffman41's Projects` с 0 проектов. Поэтому
`list_services` не вызывался: существующего `projectId` нет. Фактический прямой
каталог прочитан, Trial $5/30 days подтверждён отдельно в UI. Railway Agent не нужен.

GitHub App авторизован для одного репозитория по отдельной команде, sudo re-auth
завершён пользователем; Railway показал репозиторий в своём списке. GitHub подтвердил
основную ветку и её SHA; preflight доступа основан на этих раздельных доказательствах
и разрешении code на репозиторий, без заявления о самостоятельном Railway branch-read.
Настройки и ручной MCP-маршрут подтверждены каталогом и схемами, не пробной записью.
Подготовка #57 проверена в этой границе; локальная готовность с commit/check/review
фиксируется в отчёте. Ресурсы не создавались, публичного URL нет, будущая
запись/clone/build/выкладка и публичная приёмка относятся к #58.
[Исследование документации](../research/railway-deployment.md)
отделено от живого результата; доказательства и ограничения фиксируются в отчёте
[#57](https://github.com/skaffman41/ai-for-developers-project-386/issues/57).
