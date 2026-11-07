# 01: Проверить фактическую совместимость версий

**Status:** needs-info
**Blocked by:** None
**What to build:** проверенный набор точных версий, с которым разработчик сможет перейти к установке каркаса без обхода конфликтов engines и peerDependencies.
**Спецификация:** [Каркас приложения](../spec.md#toolchain-and-compatibility).
**Критерии спецификации:** AC-12, AC-18; ограничение на минимальную инфраструктуру.

Выполняется по запросу `$implement 01-verify-toolchain` от 2026-11-07. Разрешена только проверка toolchain и необходимые уточнения спецификации; установка зависимостей и реализация остальных задач не входят в этот запрос.

## Критерии завершения

- [ ] Для каждой базовой версии из спецификации подтверждено существование публикации. Проверены реальные engines и peerDependencies опубликованных npm-пакетов, а не только getting started и требования последних версий.
- [ ] В набор включены все необходимые прямые вспомогательные зависимости: типы Node ветки 24, типы React ветки 19, конфигурационные пакеты линтера и browser/Node globals. Выбраны их точные совместимые версии; дополнительные плагины без необходимости не добавлены.
- [ ] Подтверждены согласованность React и React DOM, совместимость Vite с React-плагином и Vitest, TypeScript с typescript-eslint, ESLint со всеми выбранными конфигурациями. Проверен диапазон Node каждого инструмента.
- [ ] В официальных релизах подтверждено наличие mise и hk для macOS arm64 и Linux x64; версия npm сверена с выбранным дистрибутивом Node.
- [ ] В Answer записана таблица итоговых точных версий, ограничений совместимости и ссылок на фактические метаданные с датой проверки. Необходимые минимальные корректировки отражены в спецификации до установки. Если совместимого набора нет, установка не начинается.
- [x] Не установлены зависимости, не создано приложение или CI. Эта задача проверяет публикации и ограничения; разрешение полного дерева в выбранном окружении обязательно выполняется в задаче 02 до первой установки.

## Команды проверки

Команды читают метаданные registry; применять их при будущей реализации задачи. Аналогично проверить каждый выбранный вспомогательный пакет по его точной версии.

| Команда | Что проверить |
| --- | --- |
| `npm view react-dom@19.3.1 version engines peerDependencies --json` | Совместимость с выбранным React. |
| `npm view vite@8.3.6 version engines peerDependencies --json` | Node и обязательные peer-зависимости Vite. |
| `npm view @vitejs/plugin-react@6.2.1 version engines peerDependencies --json` | Совместимость React-плагина с Vite. |
| `npm view fastify@5.12.8 version engines peerDependencies --json` | Метаданные точной версии backend framework. |
| `npm view vitest@5.1.0 version engines peerDependencies --json` | Совместимость тестового runner с Node и Vite. |
| `npm view typescript@6.0.3 version engines --json` | Существование выбранного компилятора и требования Node. |
| `npm view typescript-eslint@8.72.1 version engines peerDependencies --json` | Поддержка выбранных TypeScript и ESLint. |
| `npm view eslint@10.14.0 version engines peerDependencies --json` | Требования линтера. |
| `npm view prettier@3.9.10 version engines --json` | Требования форматтера. |
| `npm view eslint-config-prettier@10.1.8 version engines peerDependencies --json` | Совместимость конфигурации с ESLint. |
| `npm view npm@11.19.1 version engines --json` | Требования выбранного npm. |
| `curl --fail --silent --show-error https://api.github.com/repos/jdx/mise/releases/tags/v2026.11.3` | Релиз mise и артефакты целевых платформ. |
| `curl --fail --silent --show-error https://api.github.com/repos/jdx/hk/releases/tags/v2.11.1` | Релиз hk и артефакты целевых платформ. |

Если доступного npm нет, читать те же публикации через HTTPS API registry; устанавливать инструмент только ради исследования не требуется. Выход команды с кодом 0 подтверждает получение метаданных, но совместимость определяется сопоставлением всех ограничений. Не считать пустое поле engines подтверждением runtime-проверки; дополнительно свериться с официальной политикой поддержки.

## Answer

Дата проверки: **2026-11-07**. **Промежуточный результат: окончательный совместимый набор не подтверждён.** Полные метаданные npm-публикаций и платформенные assets mise/hk получить не удалось. Задача не завершена; задача 02 остаётся заблокирована. Не установлена ни одна зависимость, manifests и lockfiles не созданы, dry-run дерева не выполнялся.

### Что подтверждено

- [Официальный Node.js 24.22.2 LTS](https://nodejs.org/en/blog/release/v24.22.2) опубликован 2026-10-28; на странице есть дистрибутивы `node-v24.22.2-darwin-arm64.tar.gz` и `node-v24.22.2-linux-x64.tar.xz` с SHA-256. Это целевые платформы проекта.
- В [npm package.json внутри тега Node v24.22.2](https://raw.githubusercontent.com/nodejs/node/v24.22.2/deps/npm/package.json) версия **11.19.1**, engines Node `^20.17.0 || >=22.9.0`. Выбранный Node удовлетворяет этому диапазону. Обновлять npm отдельно не требуется.
- Получены [реальные registry-метаданные React](https://registry.npmjs.org/react/latest): на момент проверки `version: 19.3.1`, engines Node `>=0.10.0`, peerDependencies отсутствуют, указан tarball `react-19.3.1.tgz`. Это подтверждает именно эту публикацию; `latest` здесь источник наблюдения, а не версия для manifest.
- Подтверждено существование официальных релизов [mise 2026.11.3](https://github.com/jdx/mise/releases/tag/v2026.11.3) и [hk 2.11.1](https://github.com/jdx/hk/releases/tag/v2.11.1). Списки assets на доступных страницах не загрузились; наличие бинарников обеих целевых платформ этим не подтверждено.

### Ограничения базовых версий

Кроме React, строки ниже прочитаны из исходных `package.json` **точных release-тегов**, а не из опубликованных npm-артефактов. Это предварительное сопоставление ограничений, которое нельзя считать выполнением первого критерия задачи. Отсутствующее поле обозначает отсутствие ограничения в прочитанном файле, а не проверенную поддержку runtime.

| Пакет | Базовая версия | Node engines в прочитанном источнике | peerDependencies и вывод |
| --- | --- | --- | --- |
| [react](https://registry.npmjs.org/react/latest) | 19.3.1 | `>=0.10.0` | Peers отсутствуют; npm-публикация подтверждена. |
| [react-dom](https://raw.githubusercontent.com/react/react/v19.3.1/packages/react-dom/package.json) | 19.3.1 | Поле отсутствует | React `^19.3.1`: выбранная пара удовлетворяет ограничению. |
| [typescript](https://raw.githubusercontent.com/microsoft/TypeScript/v6.0.3/package.json) | 6.0.3 | `>=14.17` | Peers отсутствуют. |
| [vite](https://raw.githubusercontent.com/vitejs/vite/v8.3.6/packages/vite/package.json) | 8.3.6 | `^20.19.0 \|\| >=22.12.0` | Optional `@types/node`: `^20.19.0 \|\| >=22.12.0`; ветка 24 подходит. Остальные optional peers не нужны для минимального React + CSS. |
| [@vitejs/plugin-react](https://raw.githubusercontent.com/vitejs/vite-plugin-react/plugin-react@6.2.1/packages/plugin-react/package.json) | 6.2.1 | `^20.19.0 \|\| >=22.12.0` | Обязательный Vite `^8.0.0`: 8.3.6 подходит. Babel/React Compiler и oxc peers optional. |
| [fastify](https://raw.githubusercontent.com/fastify/fastify/v5.12.8/package.json) | 5.12.8 | Поле отсутствует | Peers отсутствуют; отдельно применяется политика поддержки ниже. |
| [vitest](https://raw.githubusercontent.com/vitest-dev/vitest/v5.1.0/packages/vitest/package.json) | 5.1.0 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | Vite `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; optional `@types/node`: `^22.0.0 \|\| >=24.0.0`. Выбранные Vite и Node подходят. |
| [eslint](https://raw.githubusercontent.com/eslint/eslint/v10.14.0/package.json) | 10.14.0 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | Только optional `jiti: *`; для `eslint.config.mjs` не требуется. |
| [typescript-eslint](https://raw.githubusercontent.com/typescript-eslint/typescript-eslint/v8.72.1/packages/typescript-eslint/package.json) | 8.72.1 | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | ESLint `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, TypeScript `>=4.8.4 <6.1.0`: 10.14.0 и 6.0.3 подходят. |
| [prettier](https://raw.githubusercontent.com/prettier/prettier/3.9.10/package.json) | 3.9.10 | `>=22` | Peers отсутствуют в исходнике; требования собранного npm-пакета ещё нужно получить. |
| [eslint-config-prettier](https://raw.githubusercontent.com/prettier/eslint-config-prettier/v10.1.8/package.json) | 10.1.8 | Поле отсутствует | ESLint `>=7.0.0`: 10.14.0 подходит. Отдельный Prettier не является его peer. |

По этим исходникам Node **24.22.2 удовлетворяет всем явно указанным диапазонам**. Это вывод из метаданных, не runtime-проверка. [Fastify 5 Migration Guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) устанавливает минимум Node 20; [LTS policy](https://fastify.dev/docs/latest/Reference/LTS/) предусматривает актуальные patch-релизы поддерживаемых LTS-веток Node. Для React DOM политика [версий React](https://react.dev/versions) и одинаковые версии пары согласуются с браузерным frontend; SSR на Node не входит в задачу. Пакет eslint-config-prettier содержит конфигурацию, ограничение ESLint проверяется его peer-диапазоном; исполнение CLI и общей конфигурации будет проверено после установки в следующих задачах.

Полные списки optional peers Vite/Vitest и преобразованные при публикации зависимости ещё требуется сверить с registry. `workspace:*` и `catalog:` в исходниках monorepo не являются допустимой заменой метаданных опубликованных пакетов. Для HTTP smoke в Node environment не нужны browser providers, jsdom, happy-dom, coverage и UI-пакеты.

### Необходимые прямые вспомогательные зависимости

| Пакет | Кандидат или обязательная ветка | Проверенное основание и что осталось |
| --- | --- | --- |
| `@types/node` | Ветка 24; точная версия не утверждена | Нужна backend, конфигурациям Vite/Vitest и smoke. Ограничения Vite/Vitest допускают ветку 24. Исходник DefinitelyTyped содержит служебную версию `24.19.9999`, которую нельзя переносить в manifest; нужна фактическая npm-публикация. |
| `@types/react` | Ветка 19; точная версия не утверждена | Нужна TSX frontend; фактические npm-метаданные недоступны. |
| `@types/react-dom` | Ветка 19; точная версия не утверждена | Нужна `react-dom/client`; её peer `@types/react` нужно проверить у выбранной точной npm-версии. |
| [@eslint/js](https://raw.githubusercontent.com/eslint/eslint/v10.14.0/packages/js/package.json) | 10.0.1, публикация не подтверждена | Это версия пакета внутри тега ESLint 10.14.0. Node `^20.19.0 \|\| ^22.13.0 \|\| >=24`, optional peer ESLint `^10.0.0`; выбранные Node/ESLint подходят. Нельзя автоматически выбирать не проверенную `@eslint/js@10.14.0` по номеру ESLint. |
| [globals](https://raw.githubusercontent.com/sindresorhus/globals/v17.13.0/package.json) | 17.13.0, публикация не подтверждена | Node `>=18`, peers отсутствуют в теге. Предоставляет browser и Node globals без дополнительных плагинов. |

Дополнительные React-плагины линтера и отдельные прямые `@typescript-eslint/parser`/`eslint-plugin` не требуются согласованной recommended-конфигурации через пакет `typescript-eslint`. Его опубликованные зависимости всё равно нужно проверить; полный транзитивный граф разрешается в задаче 02.

### Недоступные проверки и продолжение

1. HTTPS-запросы Python к registry: в sandbox ошибка DNS, после разрешённой сетевой эскалации — тайм-ауты. Повторные read-only запросы curl к registry, GitHub API и raw.githubusercontent.com также завершились тайм-аутами. `npm view react@19.3.1 version engines peerDependencies --json --offline --logs-max=0` завершился `ENOTCACHED`; локальный кеш не заменяет сетевую проверку.
2. Веб-инструмент прочитал указанные release-теги и registry React/TypeScript latest, но запросы точных npm-версий и GitHub release API завершились ошибками доступа; npm web pages часто вернули HTTP 403. Registry TypeScript latest содержит 7.0.2, но эта версия не выбрана, поскольку выходит за диапазон typescript-eslint.
3. Встроенный Chrome CLI найден штатным IDE-инструментом, однако запуск завершился `Timeout: file /tmp/chrome-devtools-mcp-502/daemon.pid not found within 10000ms`. Другой браузер не используется без ответа на запрос пользователя согласно инструкции этого skill.
4. После восстановления доступа получить для **всех** точных npm-версий `version`, `engines`, `peerDependencies`, `peerDependenciesMeta` и `dependencies`. Выбрать опубликованные точные версии типов и подтвердить `@eslint/js`/`globals`; сопоставить обязательные и выбранные optional peers. Недоступный источник не означает 404 или отсутствующую публикацию.
5. Прочитать `assets` официальных релизов mise 2026.11.3 и hk 2.11.1, записать имена и ссылки бинарников macOS arm64 и Linux x64. Наличие тега или общей инструкции установки недостаточно. [Инструкция hk](https://hk.jdx.dev/getting_started.html) подтверждает встроенный Pkl evaluator; отдельный Pkl CLI не нужен.
6. Только после завершения этих проверок утвердить итоговую таблицу, обновить спецификацию при необходимости и закрыть задачу. Затем по отдельному запросу в задаче 02 выполнить строгий dry-run на выбранных Node/npm до установки. Установленный сейчас Node 24.22.1 с npm 11.19.1 не выдаётся за выбранный Node 24.22.2.

### Проверка изменений

В репозитории пока нет `package.json`, TypeScript-конфигураций или тестовых файлов: typecheck, отдельные тесты и полный suite не применимы. Новые тесты не добавлены. Защищённый workflow Hexlet сохранён: SHA-256 `c8018c9fd5de3ef086be6307a7f265722936cd4c8ea05354285023d2b994187b` совпадает с исходной контрольной точкой спецификации.

## Comments

- Пользователь потребовал проверить фактическую совместимость до установки зависимостей. Начало реализации этой задачи текущим запросом не разрешено.
- 2026-11-07: пользователь запустил `$implement 01-verify-toolchain`; задача принята в работу. Прежний запрет относился к запросу на подготовку плана.
- 2026-11-07: сохранён промежуточный результат; статус `needs-info`, поскольку npm-метаданные и release assets недоступны. Запрошено разрешение на другой браузер после сбоя штатного Chrome CLI. Критерии совместимости остаются незавершёнными, установка не начинается.
