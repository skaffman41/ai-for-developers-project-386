# Подготовка агентной среды

Выполни эти шаги после [установки проекта](../../README.md#установка), когда нужен
Codex в WebStorm или CLI. Инструменты приложения и зависимости уже подготовлены
через mise; доступ к GitHub и глобальные скиллы настраиваются отдельно.

## GitHub CLI

`mise.toml` закрепляет gh 2.103.3, а `mise.lock` содержит контрольные суммы и
provenance для macOS arm64 и Linux x64. Проверь версию и авторизацию:

```sh
mise exec -- gh --version
mise exec -- gh auth status --hostname github.com
```

Если активной авторизации нет, выполни интерактивный вход:

```sh
mise exec -- gh auth login --hostname github.com --git-protocol https --web
```

Перед работой проверь имя целевого репозитория и свои права:

```sh
mise exec -- gh repo view skaffman41/ai-for-developers-project-386 \
  --json nameWithOwner,url,viewerPermission
```

Ожидаемое `nameWithOwner` — `skaffman41/ai-for-developers-project-386`.
Для записи в Issues нужны соответствующие права. Авторизация хранится в
пользовательском окружении GitHub CLI; секреты в репозиторий не добавляются.
Эти проверки выполняются локально и не входят в `mise run check` или CI приложения.

### Git HTTPS и credential helper

Успешный запрос `gh` подтверждает доступ к API, но Git использует собственную цепочку
credential helpers. Для HTTPS remote подключи существующую авторизацию gh к текущему
клону. Сначала прочитай конфигурацию, чтобы сохранить назначение существующих helpers:

```sh
git remote get-url origin
git config --show-origin --get-all credential.helper
git config --show-origin --get-all credential.https://github.com.helper
```

Отсутствующий ключ `git config --get-all` возвращает код 1; это ожидаемый результат.
Для выбранного gh-helper настрой только текущий клон:

```sh
git config --local --replace-all credential.https://github.com.helper ''
git config --local --add credential.https://github.com.helper \
  '!mise exec -- gh auth git-credential'
```

Пустое первое значение сбрасывает унаследованную цепочку для GitHub, второе обращается
к авторизации gh в системном хранилище. Секрет в Git config не записывается. Если Git
запускается из GUI без mise в `PATH`, используй в helper абсолютный путь из
`command -v mise`. Настройка хранится в `.git/config`, используется worktree этого
клона и выполняется заново для нового клона. Глобальный `gh auth setup-git` нужен
только при намеренной настройке всех репозиториев пользователя.

Справка: [Git credential helpers](https://git-scm.com/docs/gitcredentials),
[gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git).

### Перед разрешённой публикацией

1. Проверь `origin`, активный аккаунт gh и права целевого репозитория командами выше.
   Для push нужны права записи; авторизация для чтения Issues сама по себе их не доказывает.
2. Получи актуальную базу и проверь, меняет ли публикуемый diff workflow:

   ```sh
   git fetch origin main
   git diff --name-only origin/main...HEAD -- .github/workflows/
   ```

   Если OAuth-токен из `gh auth login` используется для изменения workflow, в
   `gh auth status` должен быть scope `workflow`. При его отсутствии расширь права
   через стандартное подтверждение в браузере:

   ```sh
   mise exec -- gh auth refresh --hostname github.com --scopes workflow
   ```

   Уже подтверждённые права повторно не запрашивай. Токен в чат, remote URL или файл
   проекта передавать не нужно. Для другого типа авторизации проверь разрешения
   на изменение workflow по его контракту, а не по списку OAuth scopes.

3. Проверь Git-авторизацию без публикации:

   ```sh
   GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD
   ```

   Dry-run проверяет соединение и доступ Git, но сервер может проверять отдельные
   политики только при реальном обновлении ветки. После успеха выполняй уже разрешённый
   push. Ошибки сети обрабатывай по [tool-recovery.md](tool-recovery.md); параметры
   конкретного прокси и машины сохраняй в пользовательских настройках.

`gh auth refresh` описан в [официальной справке](https://cli.github.com/manual/gh_auth_refresh).

## Глобальные Matt Pocock Skills

[skills-lock.json](../../skills-lock.json) фиксирует 38 скиллов из
[`mattpocock/skills` на ревизии `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d).
Проверка 2026-11-07 подтвердила совпадение относительных наборов файлов,
содержимого всех 103 файлов и Git tree hashes всех 38 установленных папок.
Это проверенная совместимая ревизия; исходный установочный lock не хранит commit,
поэтому однозначно установить исторический commit установки нельзя.

Команда ниже предназначена для нового пользовательского окружения. Она использует
`skills@1.7.6`, выбирает ровно закреплённые 38 имён и устанавливает их глобально для
Codex в `~/.agents/skills`. Node из проекта удовлетворяет требованию CLI `>=22.20.0`.
В upstream есть ещё `software-factory`, а отдельный `find-skills` поставляется из
`vercel-labs/skills`; они в этот набор не входят.

```sh
mise exec -- npx --yes skills@1.7.6 add \
  https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d \
  --global --agent codex --yes \
  --skill ask-matt chief-of-staff claude-handoff code-review codebase-design \
    diagnosing-bugs domain-modeling git-guardrails-claude-code grill-me grill-with-docs \
    grilling handoff implement implement-spec improve-codebase-architecture \
    loop-me migrate-to-shoehorn pr prototype research \
    retro scaffold-exercises setup-matt-pocock-skills setup-pre-commit setup-ts-deep-modules \
    tdd teach to-questionnaire to-spec to-tickets \
    triage wait-what wayfinder wizard writing-beats \
    writing-for-agents writing-fragments writing-shape
```

Источник с SHA и все параметры проверены парсерами официального CLI 1.7.6 без запуска
установщика. При подготовке этого изменения существующие глобальные скиллы были
сохранены. Проектные соглашения находятся в репозитории, личные настройки — в
пользовательских инструкциях.

### Проверка установленного набора

Из корня репозитория выполни проверку папок по `skills-lock.json`. Она читает файлы
и сравнивает число файлов и SHA-256 каждой папки с проверенным upstream:

```sh
mise exec -- node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const lock = JSON.parse(await readFile('skills-lock.json', 'utf8'));
async function files(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await files(root, path));
    else result.push(path);
  }
  return result.sort();
}

let total = 0;
for (const skill of lock.skills) {
  const root = join(homedir(), '.agents', 'skills', skill.name);
  const paths = await files(root);
  assert.equal(paths.length, skill.fileCount, skill.name);
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path).update('\0');
    hash.update(createHash('sha256').update(await readFile(join(root, path))).digest());
  }
  assert.equal(hash.digest('hex'), skill.folderSha256, skill.name);
  total += paths.length;
}
assert.equal(lock.skills.length, lock.verification.skillCount);
assert.equal(total, lock.verification.fileCount);
console.log(`Verified ${lock.skills.length} skills, ${total} files`);
JS
```

Ожидаемый результат — `Verified 38 skills, 103 files`. Алгоритм хеша записан в
lock-файле; `gitTreeSha1` связывает каждую папку с деревом закреплённого upstream.
Остальные глобальные скиллы эта проверка не затрагивает.

После установки начни новый сеанс Codex в CLI или WebStorm, чтобы обновился список
доступных скиллов. Проверь наличие `implement`, `implement-spec` и `code-review`
в списке ручных команд сеанса. Порядок работы с задачами описан в
[development-workflow.md](development-workflow.md).
