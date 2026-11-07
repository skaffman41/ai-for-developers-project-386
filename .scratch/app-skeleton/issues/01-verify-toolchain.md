# 01: Проверить фактическую совместимость версий

**Status:** resolved
**Blocked by:** None
**What to build:** проверенный набор точных версий, с которым разработчик сможет перейти к установке каркаса без обхода конфликтов engines и peerDependencies.
**Спецификация:** [Каркас приложения](../spec.md#toolchain-and-compatibility).
**Критерии спецификации:** AC-12, AC-18; ограничение на минимальную инфраструктуру.

Выполнена по запросу `$implement 01-verify-toolchain` и последующему уточнению от 2026-11-07. Результат охватывает только проверку toolchain и связанные уточнения спецификации; установка зависимостей и реализация остальных задач в него не входят.

## Критерии завершения

- [x] Для каждой базовой версии из спецификации подтверждено существование публикации. Проверены реальные engines и peerDependencies опубликованных npm-пакетов, а не только getting started и требования последних версий.
- [x] В набор включены все необходимые прямые вспомогательные зависимости: типы Node ветки 24, типы React ветки 19, конфигурационные пакеты линтера и browser/Node globals. Выбраны их точные совместимые версии; дополнительные плагины без необходимости не добавлены.
- [x] Подтверждены согласованность React и React DOM, совместимость Vite с React-плагином и Vitest, TypeScript с typescript-eslint, ESLint со всеми выбранными конфигурациями. Проверен диапазон Node каждого инструмента.
- [x] В официальных релизах подтверждено наличие mise и hk для macOS arm64 и Linux x64; версия npm сверена с выбранным дистрибутивом Node.
- [x] В Answer записана таблица итоговых точных версий, ограничений совместимости и ссылок на фактические метаданные с датой проверки. Необходимые минимальные корректировки отражены в спецификации до установки. Если совместимого набора нет, установка не начинается.
- [x] Не установлены зависимости, не создано приложение или CI. Эта задача проверяет публикации и ограничения; разрешение полного дерева в выбранном окружении обязательно выполняется в задаче 02 до первой установки.

## Команды проверки

Команды читают метаданные registry без установки. Проверены все выбранные точные версии, включая вспомогательные пакеты. При недоступном HTTPS-прокси для отдельного публичного запроса использован прямой HTTPS без изменения глобальных настроек; диагностика приведена в Answer.

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

Дата проверки: **2026-11-07**. **Все критерии задачи 01 подтверждены; статус `resolved`.** Получены фактические метаданные всех 17 выбранных npm-публикаций: 16 прямых зависимостей проекта и npm из дистрибутива Node. Версии базового набора менять не потребовалось; точные версии пяти вспомогательных пакетов добавлены в спецификацию. Полное дерево, dry-run, установка и runtime-проверки относятся к задаче 02 и здесь не выполнялись. Задача 02 выполняется по отдельному запросу.

### Доступ к источникам

Первоначальный сбой вызван настройкой `HTTPS_PROXY`: TCP-соединение с указанным прокси `fwdproxy.pyn.ru:4443` не устанавливалось. Вне sandbox DNS обоих целевых хостов работает; curl через прокси завершался кодом **28**, `http_code=000`, `time_connect=0`, `time_appconnect=0` после 5 секунд. Запрос не доходил до HTTP/TLS источника, поэтому это не отказ npm/GitHub и не признак отсутствия версии.

Повторный `curl --noproxy '*' --connect-timeout 5 --max-time 12` получил **HTTP 200** от `https://registry.npmjs.org/` и `https://api.github.com/`. Затем точные метаданные прочитаны прямыми HTTPS GET через Python `urllib.request.ProxyHandler({})`; все перечисленные ниже endpoints вернули HTTP 200. Прокси отключён только для этих запросов, глобальные настройки не менялись. Chrome CLI не использовался.

### Итоговые версии инструментов

| Инструмент | Точная версия | Фактическое подтверждение |
| --- | --- | --- |
| Node.js | 24.22.2 LTS Krypton | [Индекс дистрибутивов](https://nodejs.org/dist/index.json): запись `v24.22.2`, LTS `Krypton`, платформы `osx-arm64-tar` и `linux-x64`. Наличие архивов сверено с [SHASUMS256.txt](https://nodejs.org/dist/v24.22.2/SHASUMS256.txt). |
| npm | 11.19.1 | Совпадает в индексе Node, [встроенном package.json Node v24.22.2](https://raw.githubusercontent.com/nodejs/node/v24.22.2/deps/npm/package.json) и [npm registry](https://registry.npmjs.org/npm/11.19.1). Node engines `^20.17.0 \|\| >=22.9.0`, peers отсутствуют. Отдельная установка npm не требуется. |
| mise | 2026.11.3 | [Release API](https://api.github.com/repos/jdx/mise/releases/tags/v2026.11.3): `draft=false`, `prerelease=false`, опубликован `2026-11-06T11:18:41Z`; assets обеих платформ приведены ниже. Самостоятельный бинарник, Node не требуется. |
| hk | 2.11.1 | [Release API](https://api.github.com/repos/jdx/hk/releases/tags/v2.11.1): `draft=false`, `prerelease=false`, опубликован `2026-11-03T17:58:31Z`; assets обеих платформ приведены ниже. Самостоятельный бинарник; [официальная инструкция](https://hk.jdx.dev/getting_started.html) подтверждает встроенный Pkl evaluator, отдельный Pkl CLI не нужен. |

### Итоговые прямые npm-зависимости проекта

Ссылки ведут на метаданные **точной опубликованной версии**, а не `latest` или исходник release-тега. Проверены `version`, `dist.tarball`, `dist.integrity`, `engines`, `peerDependencies`, `peerDependenciesMeta` и `dependencies`; ни один выбранный пакет не помечен deprecated. «Отсутствует» означает отсутствие поля в публикации, а не подтверждённую runtime-проверку.

| Пакет | Точная версия | Node engines | Обязательные и выбранные optional peers |
| --- | --- | --- | --- |
| [react](https://registry.npmjs.org/react/19.3.1) | 19.3.1 | `>=0.10.0` | Peers отсутствуют. |
| [react-dom](https://registry.npmjs.org/react-dom/19.3.1) | 19.3.1 | Отсутствует | React `^19.3.1`; выбран 19.3.1. |
| [typescript](https://registry.npmjs.org/typescript/6.0.3) | 6.0.3 | `>=14.17` | Peers отсутствуют. |
| [vite](https://registry.npmjs.org/vite/8.3.6) | 8.3.6 | `^20.19.0 \|\| >=22.12.0` | Все peers optional; выбран `@types/node` 24.19.2, диапазон `^20.19.0 \|\| >=22.12.0`. |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs/plugin-react/6.2.1) | 6.2.1 | `^20.19.0 \|\| >=22.12.0` | Vite `^8.0.0`; выбран 8.3.6. |
| [fastify](https://registry.npmjs.org/fastify/5.12.8) | 5.12.8 | Отсутствует; политика Node 20+ | Peers отсутствуют. Политика поддержки рассмотрена ниже. |
| [vitest](https://registry.npmjs.org/vitest/5.1.0) | 5.1.0 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | Vite `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`: 8.3.6; optional `@types/node` `^22.0.0 \|\| >=24.0.0`: 24.19.2. |
| [eslint](https://registry.npmjs.org/eslint/10.14.0) | 10.14.0 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | Только optional `jiti: *`, не выбран. |
| [typescript-eslint](https://registry.npmjs.org/typescript-eslint/8.72.1) | 8.72.1 | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | ESLint `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`: 10.14.0; TypeScript `>=4.8.4 <6.1.0`: 6.0.3. |
| [prettier](https://registry.npmjs.org/prettier/3.9.10) | 3.9.10 | `>=14` | Peers и runtime dependencies отсутствуют в опубликованном пакете. |
| [eslint-config-prettier](https://registry.npmjs.org/eslint-config-prettier/10.1.8) | 10.1.8 | Отсутствует | ESLint `>=7.0.0`; выбран 10.14.0. Prettier не является его peer. |
| [@types/node](https://registry.npmjs.org/@types/node/24.19.2) | 24.19.2 | Отсутствует; декларации типов | Peers пусты; `typeScriptVersion=5.6`, выбран TypeScript 6.0.3. Dependency `undici-types: >=7.24.0 <7.24.7`. |
| [@types/react](https://registry.npmjs.org/@types/react/19.3.0) | 19.3.0 | Отсутствует; декларации типов | Peers пусты; `typeScriptVersion=5.6`, выбран TypeScript 6.0.3. Dependency `csstype: ^3.2.2`. |
| [@types/react-dom](https://registry.npmjs.org/@types/react-dom/19.3.0) | 19.3.0 | Отсутствует; декларации типов | `@types/react: ^19.3.0`; выбран 19.3.0. `typeScriptVersion=5.6`, выбран TypeScript 6.0.3. |
| [@eslint/js](https://registry.npmjs.org/@eslint/js/10.0.1) | 10.0.1 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` | Optional ESLint `^10.0.0`; выбран 10.14.0. Версии пакетов не обязаны совпадать. |
| [globals](https://registry.npmjs.org/globals/17.13.0) | 17.13.0 | `>=18` | Peers отсутствуют; один пакет предоставляет browser и Node globals. |

Версии типов выбраны из опубликованных стабильных версий нужных major-веток registry, затем каждая точная публикация получена отдельным GET. Служебные версии DefinitelyTyped вида `*.9999` не используются. `undici-types` и `csstype` остаются транзитивными зависимостями типов; добавлять их напрямую не требуется.

### Сопоставление ограничений

- Node **24.22.2** удовлетворяет всем явно указанным Node engines выбранного набора. npm **11.19.1** входит в этот дистрибутив. Установленный в текущей сессии Node 24.22.1 использован только для чтения и сопоставления метаданных; выбранный Node 24.22.2 не устанавливался и не запускался.
- React и React DOM имеют одинаковую версию **19.3.1**; peer React DOM выполнен. Типы обоих пакетов **19.3.0** соответствуют ветке 19; peer типов React DOM выполнен. [Официальный React DOM client](https://react.dev/reference/react-dom/client) предназначен для браузера, SSR не входит в этап: отсутствие Node engines у React DOM не трактуется как гарантия серверного runtime.
- Vite **8.3.6** попадает в диапазоны plugin-react **6.2.1** и Vitest **5.1.0**. Типы Node **24.19.2** одновременно удовлетворяют обоим optional peers. Для CSS и HTTP smoke в Node environment дополнительные optional peers не нужны.
- TypeScript **6.0.3** и ESLint **10.14.0** входят в peer-диапазоны typescript-eslint **8.72.1**. Дополнительно прочитаны его четыре зафиксированные зависимости версии 8.72.1: [parser](https://registry.npmjs.org/@typescript-eslint/parser/8.72.1), [eslint-plugin](https://registry.npmjs.org/@typescript-eslint/eslint-plugin/8.72.1), [typescript-estree](https://registry.npmjs.org/@typescript-eslint/typescript-estree/8.72.1) и [utils](https://registry.npmjs.org/@typescript-eslint/utils/8.72.1). Их Node engines и peers ESLint/TypeScript согласованы; peer плагина `@typescript-eslint/parser: ^8.72.1` выполнен. В публикациях зависимости преобразованы в реальные версии, `workspace:*`/`catalog:` не осталось в этих проверенных полях. Отдельные прямые parser/plugin не требуются.
- ESLint **10.14.0** удовлетворяет `@eslint/js` **10.0.1** и `eslint-config-prettier` **10.1.8**. [Официальный README eslint-config-prettier](https://raw.githubusercontent.com/prettier/eslint-config-prettier/v10.1.8/README.md) описывает его как конфигурацию отключения правил, в том числе flat config. Он не устанавливает отдельный минимум Node; учитываются опубликованный peer ESLint и engines выбранного ESLint. Отсутствующее поле engines само по себе не доказывает исполнение конфигурации; это проверяется общим check после установки.
- Fastify **5.12.8** не публикует engines, поэтому дополнительно прочитаны [Migration Guide точного тега](https://raw.githubusercontent.com/fastify/fastify/v5.12.8/docs/Guides/Migration-Guide-V5.md), устанавливающий Node 20+, и [LTS policy того же тега](https://raw.githubusercontent.com/fastify/fastify/v5.12.8/docs/Reference/LTS.md), охватывающая поддерживаемые LTS-ветки Node. Выбранная ветка 24 LTS подходит; сам listener здесь не запускался.
- Важное уточнение: **опубликованный Prettier 3.9.10 имеет engines Node `>=14`**, хотя исходный release package.json показывал `>=22`. Итоговая таблица использует registry; номер Prettier менять не требуется. Все три пакета типов заявляют TypeScript 5.6, компилятор 6.0.3 не ниже этого минимума.

Сверка выполнена `semver` из уже установленного npm: **21 публикация**, **15 Node engine-диапазонов**, **18 обязательных либо выбранных optional peer-связей** и **3 минимальные версии TypeScript для типов** — без ошибок. Число 21 включает 17 выбранных npm-публикаций и четыре внутренних пакета typescript-eslint. Это сопоставление опубликованных ограничений, а не разрешение или исполнение полного дерева.

### Optional peers, которые не добавляются

Все `peerDependenciesMeta` прочитаны целиком; невыбранные optional peers не превращаются в обязательные прямые зависимости:

- Vite: `tsx ^4.8.1`, `jiti >=1.21.0`, `less ^4.0.0`, `sass ^1.70.0`, `yaml ^2.4.2`, `stylus >=0.54.8`, `terser ^5.16.0`, `esbuild ^0.27.0 || ^0.28.0`, `sugarss ^5.0.0`, `sass-embedded ^1.70.0`, `@vitejs/devtools ^0.7.1 || ^0.8.0`. Отдельный optional peer `@types/node` выбран и проверен выше.
- plugin-react: `oxc-transform-react >=0.152.0 <0.157.0`, `@rolldown/plugin-babel ^0.1.7 || ^0.2.0 || ^0.3.0`, `babel-plugin-react-compiler ^1.0.0`. React Compiler и дополнительные трансформации не нужны минимальному приложению.
- Vitest: `jsdom *`, `happy-dom *`, `@edge-runtime/vm *`, `@opentelemetry/api ^1.9.0`; `@vitest/ui`, `@vitest/coverage-v8`, `@vitest/coverage-istanbul`, `@vitest/browser-preview`, `@vitest/browser-playwright` — каждый `5.1.0`; `@vitest/browser-webdriverio ^5.0.0-beta.5 || >=5.0.0`. Optional `@types/node` выбран; Vite — обязательный peer и также выбран.
- ESLint: `jiti *` optional; для `eslint.config.mjs` отдельный загрузчик TypeScript не нужен. Дополнительные React-плагины линтера не добавляются.

### Артефакты целевых платформ

Оба release API подтвердили для каждого выбранного архива `state=uploaded`, ненулевой `size`, URL и SHA-256 в `digest`. Артефакты не скачивались и не устанавливались; проверяется наличие официальной публикации, а не работоспособность бинарника в этой сессии.

| Инструмент | Платформа | Официальный asset | SHA-256 из API |
| --- | --- | --- | --- |
| mise 2026.11.3 | macOS arm64 | [mise-v2026.11.3-macos-arm64.tar.gz](https://github.com/jdx/mise/releases/download/v2026.11.3/mise-v2026.11.3-macos-arm64.tar.gz) | `de9a54330fee4edede51a3cf6196bbf522f01c5e3fd981e0bebea33f561a0431` |
| mise 2026.11.3 | Linux x64 | [mise-v2026.11.3-linux-x64.tar.gz](https://github.com/jdx/mise/releases/download/v2026.11.3/mise-v2026.11.3-linux-x64.tar.gz) | `837acae6defb8c9ad74823f6e38856633bacb04c65c1ac67d952749847543bd9` |
| hk 2.11.1 | macOS arm64 | [hk-aarch64-apple-darwin.tar.gz](https://github.com/jdx/hk/releases/download/v2.11.1/hk-aarch64-apple-darwin.tar.gz) | `95f89e6eef60e0c690b0d439b30e3b8558f47235a1a45cbff7b5351d294e4322` |
| hk 2.11.1 | Linux x64 | [hk-x86_64-unknown-linux-gnu.tar.gz](https://github.com/jdx/hk/releases/download/v2.11.1/hk-x86_64-unknown-linux-gnu.tar.gz) | `b9330bd4b9326c3e1aefd757ff923fdf6d1b060074bcb4e54e16ec0a81fde7ec` |

### Проверка результата и граница задачи

Все шесть критериев задачи отмечены выполненными. В спецификацию перенесены итоговые точные версии и источники. AC-12 и AC-18 **всей спецификации** остаются незавершёнными: manifests, lockfiles, строгий dry-run, сборки, runtime-проверки и CI относятся к следующим задачам. Текущий запрос их не разрешает.

Зависимости, приложение, хуки и CI не создавались и не устанавливались. В репозитории нет package.json, TypeScript-конфигураций или тестовых файлов: typecheck и тестовый suite здесь не применимы; новые тесты не добавлены. Защищённый workflow Hexlet побайтово совпадает с базовым коммитом; SHA-256 `c8018c9fd5de3ef086be6307a7f265722936cd4c8ea05354285023d2b994187b`.

Проверки Markdown-таблиц, локальных ссылок и `git diff --check` прошли. Финальное независимое ревью `code-review`: Standards — 0 замечаний, Spec — 0 замечаний; данные и числовые итоги сверены с полученными JSON.

## Comments

- Пользователь потребовал проверить фактическую совместимость до установки зависимостей. Начало реализации этой задачи текущим запросом не разрешено.
- 2026-11-07: пользователь запустил `$implement 01-verify-toolchain`; задача принята в работу. Прежний запрет относился к запросу на подготовку плана.
- 2026-11-07: сохранён промежуточный результат; статус `needs-info`, поскольку npm-метаданные и release assets недоступны. Запрошено разрешение на другой браузер после сбоя штатного Chrome CLI. Критерии совместимости остаются незавершёнными, установка не начинается.

- 2026-11-07: пользователь разрешил продолжить задачу 01 штатными CLI без Chrome CLI, установки зависимостей, перехода к задаче 02, новых коммитов и push. Найден недоступный HTTPS-прокси; прямые публичные HTTPS-запросы успешны. Подтверждены все npm-публикации, peers/engines и assets обеих платформ. Answer обновлён, все критерии задачи 01 выполнены, статус `resolved`.

- 2026-11-07: последующий запрос на настройку development workflow разрешил отдельный коммит завершённого результата задачи 01. Прежний запрет новых коммитов относился к проверке метаданных; реализация задачи 02 и push по-прежнему не выполняются.
