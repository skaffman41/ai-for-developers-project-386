# Выпуск приложения

Одна версия относится ко всему приложению. Приватные workspaces не публикуются в npm.
`release-please-config.json` использует manifest-режим со стратегией `simple` для корня;
`version.txt` содержит версию приложения, `.release-please-manifest.json` — последнюю
версию, а `CHANGELOG.md` — заметки к выпускам. До первого выпуска обе версии равны
`0.0.0`; `initial-version` явно задаёт первый предлагаемый выпуск `0.1.0`.

`CHANGELOG.md` генерирует release-please в собственном Markdown-формате; файл
исключён из Prettier как производный артефакт. Проверки конфигурации и генерации
инструмента, а также ручная проверка заметок Release PR описаны ниже.

Начальный диапазон начинается **после** planning-коммита
`de8d144a5c4f9fa9503ce803ca13eb9af9f7950c`: `bootstrap-sha` исключает этот коммит и
более раннюю историю из первого changelog. После первого merge Release PR инструмент
использует последний выпуск и игнорирует bootstrap-границу. `initial-version` также
применяется только при отсутствии предыдущего выпуска; постоянного `release-as` нет.

## Проверки до публикации

```sh
mise run release:check
mise run release:dry-run
mise run check
```

`release:check` проверяет оба JSON-файла по схемам из установленного
`release-please 17.6.0` и согласованность `version.txt` с manifest. Эта версия совпадает
с bundle закреплённого Action `v5.0.0`; инструменты проверки закреплены в
`package.json`/`package-lock.json`. При обновлении Action проверяйте его lockfile,
обновляйте локальный release-please и ссылку `$schema` вместе.

`release:dry-run` использует публичные `Manifest.buildPullRequests`,
`GitHub.buildChangeSet` и `Manifest.buildReleases`, которые вызывает CLI с
`--dry-run`. Настоящий release-please читает управляемую историю через подставленный
GitHub fetch: только домен `.invalid`, фиктивный token, без сетевых соединений;
неизвестные запросы и мутации запрещены. Проверяются `0.1.0`, changelog, исключение
старой истории, один стабильный Release PR, повтор существующего PR без записи,
предложение `v0.1.0` после моделируемого merge и отсутствие повторного выпуска уже
помеченного PR. Отдельно выполняется dispatch-скрипт workflow с управляемым API и
проверяются отказы при несовпадении SHA до и после check. Исходная версия в тестовой
истории задана отдельно, поэтому проверки продолжают работать внутри будущих Release PR.
Реальные PR, теги и Releases эти команды не создают. Проверки входят в общий check.

## Включение на GitHub

Сначала отдельно разрешите публикацию кода и merge настроек в `main` по
[workflow проекта](agents/development-workflow.md). Само наличие локальных файлов
не означает, что Actions уже запускался.

В Settings → Actions → General → Workflow permissions оставьте стандартные права
**Read repository contents and packages permissions** и включите
**Allow GitHub Actions to create and approve pull requests**. Это единая настройка
GitHub; автоматические одобрения и automerge в workflow не добавлены. В рамках #43
настройка включена 2026-11-09 с сохранением `default_workflow_permissions=read`;
проверить её можно read-only командой:

```sh
mise exec -- gh api repos/skaffman41/ai-for-developers-project-386/actions/permissions/workflow
```

Используется только встроенный `GITHUB_TOKEN`. У release-job явно заданы
`contents: write`, `issues: write`, `pull-requests: write` для Release PR/меток/выпуска
и `actions: write` для dispatch проверки. Остальные workflow сохраняют read-доступ.
Локальная авторизация gh не копируется в Actions secrets.

## Release PR и ручной merge

После отдельно разрешённого push в `main` workflow `release-please` поддерживает один
Release PR в ветке `release-please--branches--main`. Изменения описываются Conventional
Commits: `feat` добавляет возможность, `fix` — исправление, `!`/`BREAKING CHANGE` —
нарушение совместимости. Точную предложенную версию и changelog проверьте в PR.
При необходимости повторите workflow вручную на `main`; concurrency сериализует
запуски, а повтор использует существующий PR/выпуск.

После создания или обновления PR workflow заново читает его текущий head SHA и явно
вызывает `app-check.yml` через `workflow_dispatch`, передавая `expected_sha` и номер
PR. До checkout проверяется совпадение SHA события с ожидаемым, после полного check —
что PR остаётся открытым на том же SHA. Если ветка изменилась, устаревшая проверка
завершается ошибкой. Новый SHA должен пройти собственную проверку.

При использовании `GITHUB_TOKEN` автоматический `pull_request` запуск может ожидать
одобрения. Ожидание или одобрение такого запуска не заменяет успешный dispatch.
Перед отдельно разрешённым **ручным** merge Release PR:

1. Получите актуальный PR и SHA:

   ```sh
   mise exec -- gh pr list -R skaffman41/ai-for-developers-project-386 --head release-please--branches--main
   mise exec -- gh pr view <PR> -R skaffman41/ai-for-developers-project-386 --json headRefOid,headRefName,state
   ```

2. Убедитесь, что dispatch `app-check` именно этого SHA завершился `success`:

   ```sh
   mise exec -- gh run list -R skaffman41/ai-for-developers-project-386 --workflow app-check.yml --branch release-please--branches--main --event workflow_dispatch --commit <SHA>
   mise exec -- gh run view <RUN_ID> -R skaffman41/ai-for-developers-project-386
   ```

   Если dispatch не состоялся или завершился ошибкой, после устранения причины
   отдельно разрешённый повтор можно запустить явно:

   ```sh
   mise exec -- gh workflow run app-check.yml -R skaffman41/ai-for-developers-project-386 --ref release-please--branches--main -f expected_sha=<SHA> -f release_pr=<PR>
   ```

3. Перечитайте SHA непосредственно перед merge. Успех старого SHA не подтверждает
   обновлённый PR. Проверьте версии и changelog, затем выполните разрешённый ручной merge.

Следующий push в `main` запускает release-please: он создаёт соответствующий тег
`vX.Y.Z` и GitHub Release, затем отмечает Release PR как выпущенный. Проверьте
успешный run и совпадение тега с merge-коммитом PR:

```sh
mise exec -- gh run list -R skaffman41/ai-for-developers-project-386 --workflow release-please.yml
mise exec -- gh release view v0.1.0 -R skaffman41/ai-for-developers-project-386
mise exec -- gh api repos/skaffman41/ai-for-developers-project-386/commits/v0.1.0 --jq .sha
```

Публикация настроек, запуск реального release workflow и первый выпуск требуют
отдельных явных команд. До них удалённая цепочка остаётся непроверенной; локальный
dry-run подтверждает планирование, а полный macOS check не заменяет Ubuntu CI.

## Источники

- [Закреплённый Action и его lockfile](https://github.com/googleapis/release-please-action/tree/45996ed1f6d02564a971a2fa1b5860e934307cf7).
- [Manifest, bootstrap и начальная версия](https://github.com/googleapis/release-please/blob/v17.6.0/docs/manifest-releaser.md).
- [CLI dry-run](https://github.com/googleapis/release-please/blob/v17.6.0/docs/cli.md).
- [Триггеры workflow от GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- [REST API настройки прав Actions](https://docs.github.com/en/rest/actions/permissions#set-default-workflow-permissions-for-a-repository).
