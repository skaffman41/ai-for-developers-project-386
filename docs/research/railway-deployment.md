# Railway MCP для публичного учебного стенда

Проверено 2026-11-11 для пересмотра [#55](https://github.com/skaffman41/ai-for-developers-project-386/issues/55).
Исследование документации; аккаунт, остаток кредитов, доступ к репозиторию и фактический каталог подключённого MCP здесь не проверялись.
Ресурсы не создавались, Railway Agent не вызывался, зависимости и тесты не добавлялись.

Позднее авторизованный плагин предоставил прямые staged-инструменты без Agent; MCP-read,
Trial и source-доступ проверены отдельно. Живые доказательства, их границы и маршрут
с закреплённым `commitSha` описаны в [действующей инструкции](../deployment/railway.md).

## Предлагаемый маршрут и границы доказательства

Для одного Docker-сервиса достаточно настроек Railway: источник опубликованного `main`, выключенный GitHub autodeploy, один экземпляр, `/health`, временная SQLite и публичный домен. Новый файл IaC не является обязательным условием такого сервиса: Railway хранит источник и настройки непосредственно в сервисе. Это предложение для следующей проверки, а не подтверждение выполнения через доступный MCP. [Services](https://docs.railway.com/services).

Официальный hosted endpoint — `https://mcp.railway.com`; прямой OAuth не требует CLI. OAuth позволяет выбрать доступные проекты/workspace. Секреты не должны попадать в шаблон подключения. [MCP server](https://docs.railway.com/ai/mcp-server).

## Что известно о hosted MCP

Документированы `whoami`, `list-projects`, `list-services`, `create-project`, `redeploy`, `accept-deploy` и `railway-agent`. Последний выполняет многошаговую настройку сервиса; `accept-deploy` фиксирует staged changes и запускает деплой. Документация не даёт полных схем аргументов и отдельной hosted-операции безопасного плана всех требуемых настроек. Их нужно сверить с реальным `tools/list` до записи. [MCP server](https://docs.railway.com/ai/mcp-server#available-mcp-tools).

Гарантия preview с последующим `confirm: true` описана для **локального** `railway mcp local`, у которого другой каталог. Переносить её на hosted `railway-agent` нельзя. Само слово «preview» в запросе не доказывает отсутствие мутаций. [MCP server](https://docs.railway.com/ai/mcp-server#run-the-server-locally).

Railway Agent тарифицируется по потреблённым LLM-токенам; запросы через собственный аккаунт модели оплачиваются у его провайдера. Вызов агента ради исследования также нельзя объявлять бесплатным. [Railway Agent pricing](https://docs.railway.com/ai/railway-agent#pricing).

Compute Usage и Agent Usage имеют независимые лимиты: остановка compute не отключает Agent. Проверенные страницы не устанавливают, покрывают ли Free/Trial-кредиты Agent конкретного аккаунта и доступен ли он этому аккаунту. До такого подтверждения hosted-маршрут настройки через Agent не считается доказанно совместимым с бюджетом 0 ₽. [Cost Control](https://docs.railway.com/pricing/cost-control#compute-vs-agent-usage-limits).

## Бесплатность и ограничения

- Trial новым пользователям: $5 на срок до 30 дней; после срока или исчерпания — Free с $1 в месяц без переноса остатка. Limited Trial разрешает деплой кода, но ограничивает исходящие соединения и порты; GitHub-верификация автоматическая. Это условия продукта, не состояние текущего аккаунта. [Free Trial](https://docs.railway.com/pricing/free-trial).
- Начать Trial можно без карты. Текущий тариф виден в Account Selector и Plans; при исчерпании кредитов сервис может остановиться. Платное повышение тарифа не является решением в согласованном бюджете. [Pricing FAQs](https://docs.railway.com/pricing/faqs).
- Free стоит $0/месяц; пределы сервиса — 1 replica, 0.5 GB RAM, 1 vCPU, 1 GB ephemeral storage и образ до 4 GB. У Trial — до 2 replicas, 1 GB RAM и 2 vCPU при тех же пределах ephemeral storage/образа. Сборки сервиса бесплатны; работа контейнера и исходящий трафик расходуют ресурсы. [Pricing Plans](https://docs.railway.com/pricing/plans).

Бюджет 0 ₽ допускает только доступные бесплатные кредиты без карты и платной подписки. Он не обещает круглосуточную доступность на весь месяц. Перед созданием нужны фактические тариф, остаток/срок кредитов, ограничения и отдельно условия Agent. Usage limits ограничивают расход, а resource limits — ресурсы replica; это разные настройки. [Cost Control](https://docs.railway.com/pricing/cost-control).

## Настройки единственного Docker-сервиса

| Параметр          | Основание и требуемая проверка                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Источник          | `skaffman41/ai-for-developers-project-386`, ветка `main`; перед деплоем выбранный SHA уже опубликован в `main`.                                                                                                                                        |
| Сборка            | Корневой `Dockerfile` определяется автоматически; в build log должна быть запись об использовании Dockerfile. [Dockerfiles](https://docs.railway.com/builds/dockerfiles).                                                                              |
| Запуск            | Существующий [Dockerfile](../../Dockerfile) задаёт `CMD`, `HOST=0.0.0.0` и подготовленный `/app/data/calendar.sqlite`; отдельная build/start override не требуется. Это вывод из файла проекта, а не результат удалённой сборки.                       |
| Порт и готовность | Railway инжектит `PORT`; приложение должно слушать его. Путь `/health` задаётся в настройках, Railway ждёт `2xx`; проверка выполняется при выкладке, не непрерывно. [Healthchecks](https://docs.railway.com/deployments/healthchecks).                 |
| Масштабирование   | Явно 1 replica в одном регионе, включая Trial. Изменение replicas staged. [Scaling](https://docs.railway.com/deployments/scaling).                                                                                                                     |
| Хранение          | Без volume и внешней БД. Файлы вне volume не сохраняются между деплоями; согласована потеря SQLite при замене контейнера. [Ephemeral storage](https://docs.railway.com/services#ephemeral-storage), [ADR 0006](../adr/0006-public-demo-deployment.md). |
| Публичный адрес   | Railway-provided domain и HTTPS с автоматическим SSL; факт существования адреса и ответы сервиса проверяются после разрешённой публикации. [Public networking](https://docs.railway.com/networking/public-networking).                                 |

Свойства сна Render к Railway не относятся. Если Serverless будет включён, его условия нужно описать отдельно; само исследование эту настройку не выбирает. [Cost Control: serverless](https://docs.railway.com/pricing/cost-control#enabling-serverless).

## Исходники и ручные обновления

Для GitHub source аккаунт Railway связывается с GitHub и получает доступ к репозиторию через Railway GitHub App. Успех `gh`, OAuth MCP и чтение списка проектов этого не доказывают. Проверить нужный репозиторий в Railway следует отдельно; секреты и широкие права не нужны в Git. [Service source](https://docs.railway.com/services#deploying-from-a-github-repo).

Связанный GitHub-источник по умолчанию деплоится при push в выбранную ветку. Требуется явно выключить automatic deployments и затем подтвердить состояние. Документированное ручное действие **Deploy Latest Commit** берёт последний commit подключённой ветки. [GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys).

**Redeploy повторяет тот же код и build/deploy configuration прежнего deployment.** Он не подтверждает обновление до нового `main`. В фактическом MCP нужна операция, которая явно развёртывает выбранную опубликованную версию; её название и аргументы нельзя вывести из одного наличия `redeploy`. [Deployment actions](https://docs.railway.com/deployments/deployment-actions#redeploy).

Настройки обычно собираются в staged changes; просмотр Details показывает старые и новые значения, Deploy применяет их вместе. **Networking changes применяются немедленно и не staged.** Поэтому создание домена нельзя включать в обещание «только подготовить план». Для конфигурации также нужны явное применение и контроль результата; отсутствие автодеплоя кода само по себе этого не обеспечивает. [Staged Changes](https://docs.railway.com/deployments/staged-changes).

## Почему не railway.json или railway.toml

Config as Code устарел: новые сервисы уже не могут его включить; существующие файлы перестанут читаться 2026-12-01. Замена — `.railway/railway.ts` (GA) либо Python/Go (beta), вычисляемые CLI. `railway config plan` только читает состояние; `apply` применяет подтверждённый план. Railway не читает `.railway/` при обычном деплое, автоматический CI apply — отдельный выбор. [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code).

Для текущего одного сервиса не следует добавлять SDK и IaC только ради замены старого формата. Сначала проверить доступную MCP-настройку. Если она не позволяет воспроизвести все условия, сохранить пробел; CLI/REST/Dashboard не выдавать за выполненный MCP-критерий. Это вывод исследования в рамках [плана v2](../plans/step-7-render-free/v2/spec.md).

## Что остаётся подтвердить до ресурсов

1. Реальное MCP-чтение выбранного аккаунта, проектов и сервисов; точные схемы доступных операций.
2. Free/Trial, доступный бесплатный остаток и срок, отсутствие необходимости карты/платного upgrade; отдельно стоимость и доступность Agent, если маршрут зависит от него.
3. Доступ Railway к репозиторию и опубликованному SHA `main`, отдельно от OAuth MCP.
4. MCP-возможности задать GitHub source, отключить autodeploy до первой выкладки, сохранить Docker, `/health`, одну replica и отсутствие volume; получить проверяемое описание перед применением.
5. Раздельные явные операции применения конфигурации, создания домена и деплоя нового выбранного commit; чтение итоговых параметров и deployment metadata.

Ни один из этих пунктов не подтверждён исследованием аккаунта. Недостающий инструмент или бесплатный лимит оставляет соответствующий критерий незавершённым, сохраняя уже проверенный локальный Docker-результат #56.
