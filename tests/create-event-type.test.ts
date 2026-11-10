import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import {
  prepareDatabase,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

test("owner creates a type once and the guest reads its normalized persistent details", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    backend = await startBackend(database.path);
    const key = randomUUID();
    const payload = {
      name: "  Разговор  ",
      durationMinutes: 45,
      description: "  О проекте\nи планах  ",
    };
    const send = () =>
      fetch(`${backend!.url}/api/event-types`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });
    const response = await send();
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      idempotencyKey: key,
      data: {
        id: expect.any(String),
        displayCode: "В-000001",
        name: "Разговор",
        durationMinutes: 45,
        description: "О проекте\nи планах",
      },
    });
    expect(await (await send()).json()).toEqual(body);
    await backend.stop();
    backend = await startBackend(database.path);
    expect(await (await send()).json()).toEqual(body);
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual({ data: [body.data] });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

async function withBackend(run: (url: string, path: string) => Promise<void>) {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    backend = await startBackend(database.path);
    await run(backend.url, database.path);
  } finally {
    await backend?.stop();
    await database.dispose();
  }
}
function post(url: string, key: string, body: unknown) {
  return fetch(`${url}/api/event-types`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

test("concurrent duplicates replay exactly while independent keys and names remain independent", async () => {
  await withBackend(async (url) => {
    const key = randomUUID();
    const raw = { name: "Разговор", durationMinutes: 1 };
    const replies = await Promise.all(
      Array.from({ length: 8 }, () => post(url, key, raw)),
    );
    expect(replies.map((reply) => reply.status)).toEqual(Array(8).fill(201));
    const values = await Promise.all(replies.map((reply) => reply.json()));
    expect(
      values.every(
        (value) => JSON.stringify(value) === JSON.stringify(values[0]),
      ),
    ).toBe(true);
    const reordered = await post(url, key, {
      durationMinutes: 1,
      name: "Разговор",
    });
    expect(await reordered.json()).toEqual(values[0]);
    for (const changed of [
      { ...raw, name: " Разговор " },
      { ...raw, description: "" },
      { ...raw, durationMinutes: 45 },
    ]) {
      const response = await post(url, key, changed);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        idempotencyKey: key,
        outcome: "unknown",
        error: { code: "IDEMPOTENCY_KEY_REUSED" },
      });
    }
    expect(await (await post(url, key, raw)).json()).toEqual(values[0]);
    const independent = await (await post(url, randomUUID(), raw)).json();
    expect(independent.data.id).not.toBe(values[0].data.id);
    expect(independent.data.displayCode).toBe("В-000002");
    expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
      data: [independent.data, values[0].data],
    });
  });
});

for (const body of [
  null,
  [],
  1,
  "name",
  {},
  { name: 3, durationMinutes: 30 },
  { name: "Имя", durationMinutes: "30" },
  { name: "Имя", durationMinutes: 1.1 },
  { name: "Имя", durationMinutes: 0 },
  { name: "Имя", durationMinutes: 541 },
  { name: "Имя", durationMinutes: 30, extra: true },
  { name: "Имя", durationMinutes: 30, description: null },
  { name: " ", durationMinutes: 30 },
  { name: "А\nБ", durationMinutes: 30 },
  { name: "А\u2028Б", durationMinutes: 30 },
  { name: "А\u2029Б", durationMinutes: 30 },
  { name: "я".repeat(101), durationMinutes: 30 },
  { name: "Имя", durationMinutes: 30, description: "x".repeat(2001) },
]) {
  test(`strict invalid JSON values become a saved refusal: ${JSON.stringify(body).slice(0, 90)}`, async () => {
    await withBackend(async (url) => {
      const key = randomUUID();
      const first = await post(url, key, body);
      expect(first.status).toBe(422);
      const saved = await first.json();
      expect(saved).toMatchObject({
        idempotencyKey: key,
        outcome: "rejected",
        error: { code: "VALIDATION_ERROR" },
      });
      expect(await (await post(url, key, body)).json()).toEqual(saved);
      expect(
        (await post(url, key, { name: "Исправлено", durationMinutes: 30 }))
          .status,
      ).toBe(409);
      expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
        data: [],
      });
    });
  });
}

test("limits count Unicode characters after trim and empty descriptions are absent", async () => {
  await withBackend(async (url) => {
    const response = await post(url, randomUUID(), {
      name: `  ${"😀".repeat(100)}  `,
      durationMinutes: 540,
      description: `  ${"😀".repeat(2000)}\n `,
    });
    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({
      name: "😀".repeat(100),
      durationMinutes: 540,
      description: "😀".repeat(2000),
    });
    const empty = await post(url, randomUUID(), {
      name: " Одно ",
      durationMinutes: 1,
      description: " \n ",
    });
    expect(empty.status).toBe(201);
    expect((await empty.json()).data).not.toHaveProperty("description");
  });
});

test("malformed JSON and invalid keys remain unknown and do not reserve a valid key", async () => {
  await withBackend(async (url) => {
    const key = randomUUID();
    const malformed = await fetch(`${url}/api/event-types`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": key },
      body: "{broken",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      outcome: "unknown",
      error: { code: "INVALID_REQUEST" },
    });
    for (const bad of ["", "invalid"]) {
      const response = await post(url, bad, {
        name: "Тип",
        durationMinutes: 30,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ outcome: "unknown" });
    }
    expect(
      (await post(url, key, { name: "Тип", durationMinutes: 30 })).status,
    ).toBe(201);
  });
});

test.each([
  { stage: "beforeCommit", valid: true },
  { stage: "afterCommit", valid: true },
  { stage: "beforeCommit", valid: false },
  { stage: "afterCommit", valid: false },
])(
  "forced process stop at $stage preserves a complete result or rollback (valid=$valid)",
  async ({ stage, valid }) => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const database = await temporaryDatabase();
    let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
    try {
      await prepareDatabase(database.path);
      const marker = join(database.directory, "stage");
      backend = await startBackend(database.path, 0, {
        entry: "tests/support/commit-backend.ts",
        env: { STOP_STAGE: stage, STAGE_MARKER: marker },
      });
      const key = randomUUID();
      const body = { name: valid ? "Надёжный тип" : "", durationMinutes: 45 };
      const interrupted = post(backend.url, key, body).catch(() => undefined);
      await expect
        .poll(async () => readFile(marker, "utf8").catch(() => ""), {
          timeout: 5000,
        })
        .toBe(stage);
      backend.kill("SIGKILL");
      await backend.stop();
      await interrupted;
      backend = await startBackend(database.path);
      const before = await (
        await fetch(`${backend.url}/api/event-types`)
      ).json();
      expect(before.data).toHaveLength(
        stage === "afterCommit" && valid ? 1 : 0,
      );
      const { DatabaseSync } = await import("node:sqlite");
      const disk = new DatabaseSync(database.path);
      try {
        expect(
          disk.prepare("SELECT count(*) AS count FROM operation_results").get(),
        ).toMatchObject({ count: stage === "afterCommit" ? 1 : 0 });
      } finally {
        disk.close();
      }
      const retry = await post(backend.url, key, body);
      expect(retry.status).toBe(valid ? 201 : 422);
      const saved = await retry.json();
      if (stage === "afterCommit" && valid)
        expect(saved.data).toEqual(before.data[0]);
      expect(await (await post(backend.url, key, body)).json()).toEqual(saved);
      expect(
        await (await fetch(`${backend.url}/api/event-types`)).json(),
      ).toEqual({ data: valid ? [saved.data] : [] });
    } finally {
      backend?.kill("SIGCONT");
      await backend?.stop();
      await database.dispose();
    }
  },
);

test("a saved validation refusal survives restart without creating an entity", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    backend = await startBackend(database.path);
    const key = randomUUID();
    const raw = { name: "", durationMinutes: 30 };
    const saved = await (await post(backend.url, key, raw)).json();
    await backend.stop();
    backend = await startBackend(database.path);
    const retry = await post(backend.url, key, raw);
    expect(retry.status).toBe(422);
    expect(await retry.json()).toEqual(saved);
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual({ data: [] });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("schema upgrade preserves v1 data and commits its version with the new result table", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const old = new DatabaseSync(database.path);
    old.exec("DROP TABLE operation_results; PRAGMA user_version=1");
    old
      .prepare(
        "INSERT INTO event_types(id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
      )
      .run("old", "Прежний тип", 30, 1);
    old.close();
    backend = await startBackend(database.path);
    expect(
      (await (await fetch(`${backend.url}/api/event-types`)).json()).data[0].id,
    ).toBe("old");
    const created = await (
      await post(backend.url, randomUUID(), {
        name: "Новый",
        durationMinutes: 30,
      })
    ).json();
    expect(created.data.displayCode).toBe("В-000002");
    await backend.stop();
    backend = await startBackend(database.path);
    expect(
      (await (await fetch(`${backend.url}/api/event-types`)).json()).data.map(
        (value: { id: string }) => value.id,
      ),
    ).toEqual([created.data.id, "old"]);
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("a database lock cannot be reported as a saved refusal; retry remains safe", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  await withBackend(async (url, path) => {
    const lock = new DatabaseSync(path);
    const key = randomUUID();
    const body = { name: "Тип", durationMinutes: 30 };
    try {
      lock.exec("BEGIN IMMEDIATE");
      const response = await post(url, key, body);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        idempotencyKey: key,
        outcome: "unknown",
        error: { code: "INTERNAL_ERROR" },
      });
      lock.exec("ROLLBACK");
      expect((await post(url, key, body)).status).toBe(201);
      expect(
        (await (await fetch(`${url}/api/event-types`)).json()).data,
      ).toHaveLength(1);
    } finally {
      if (lock.isTransaction) lock.exec("ROLLBACK");
      lock.close();
    }
  });
}, 15000);

test("failure before migration commit rolls the supported schema change back with its previous version and data", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { runNode } = await import("./support/backend.ts");
  const database = await temporaryDatabase();
  try {
    await prepareDatabase(database.path);
    const old = new DatabaseSync(database.path);
    old.exec("DROP TABLE operation_results; PRAGMA user_version=1");
    old
      .prepare(
        "INSERT INTO event_types(id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
      )
      .run("old", "Сохранённый тип", 30, 1);
    old.close();
    const result = await runNode(
      [
        "--input-type=module",
        "-e",
        "import {openDatabase} from './backend/src/storage.ts'; openDatabase(process.env.DATABASE_PATH,{beforeMigrationCommit(){throw new Error('Controlled migration failure')}});",
      ],
      { DATABASE_PATH: database.path },
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("Controlled migration failure");
    const unchanged = new DatabaseSync(database.path);
    try {
      expect(unchanged.prepare("PRAGMA user_version").get()).toMatchObject({
        user_version: 1,
      });
      expect(
        unchanged
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name='operation_results'",
          )
          .all(),
      ).toEqual([]);
      expect(unchanged.prepare("SELECT id FROM event_types").all()).toEqual([
        { id: "old" },
      ]);
    } finally {
      unchanged.close();
    }
    const backend = await startBackend(database.path);
    try {
      expect(
        (await (await fetch(`${backend.url}/api/event-types`)).json()).data[0]
          .id,
      ).toBe("old");
    } finally {
      await backend.stop();
    }
  } finally {
    await database.dispose();
  }
});

test.each([true, false])(
  "failure saving an attempt result cannot expose a false final outcome (valid=%s)",
  async (valid) => {
    const { DatabaseSync } = await import("node:sqlite");
    await withBackend(async (url, path) => {
      const fault = new DatabaseSync(path);
      const key = randomUUID();
      const body = { name: valid ? "Тип" : "", durationMinutes: 30 };
      try {
        fault.exec(
          "CREATE TRIGGER fail_attempt BEFORE INSERT ON operation_results BEGIN SELECT RAISE(FAIL, 'Controlled disk write failure'); END",
        );
        const response = await post(url, key, body);
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          outcome: "unknown",
          idempotencyKey: key,
        });
        expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
          data: [],
        });
        fault.exec("DROP TRIGGER fail_attempt");
        const retry = await post(url, key, body);
        expect(retry.status).toBe(valid ? 201 : 422);
        const saved = await retry.json();
        expect(await (await post(url, key, body)).json()).toEqual(saved);
        if (valid) expect(saved.data.displayCode).toBe("В-000001");
        else expect(saved.outcome).toBe("rejected");
      } finally {
        fault.close();
      }
    });
  },
);

test("a real COMMIT busy failure rolls back the active transaction and never reruns its body", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  await withBackend(async (url, path) => {
    const reader = new DatabaseSync(path);
    const key = randomUUID();
    const body = { name: "Тип", durationMinutes: 30 };
    try {
      reader.exec("BEGIN");
      reader.prepare("SELECT * FROM event_types").all();
      const response = await post(url, key, body);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        outcome: "unknown",
        idempotencyKey: key,
      });
      reader.exec("ROLLBACK");
      expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
        data: [],
      });
      const retry = await post(url, key, body);
      expect(retry.status).toBe(201);
      const saved = await retry.json();
      expect(saved.data.displayCode).toBe("В-000001");
      expect(await (await post(url, key, body)).json()).toEqual(saved);
      expect(
        (await (await fetch(`${url}/api/event-types`)).json()).data,
      ).toHaveLength(1);
    } finally {
      if (reader.isTransaction) reader.exec("ROLLBACK");
      reader.close();
    }
  });
}, 15000);

test("POST only interprets its declared JSON media type and leaves other payloads unknown", async () => {
  await withBackend(async (url) => {
    const key = randomUUID();
    const response = await fetch(`${url}/api/event-types`, {
      method: "POST",
      headers: { "content-type": "text/plain", "Idempotency-Key": key },
      body: JSON.stringify({ name: "Тип", durationMinutes: 30 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      outcome: "unknown",
      error: { code: "INVALID_REQUEST" },
    });
    expect(
      (await post(url, key, { name: "Тип", durationMinutes: 30 })).status,
    ).toBe(201);
  });
});

for (const [firstKey, secondKey] of [
  ["a", "a\u0000"],
  ["é", "e\u0301"],
]) {
  test(`reordering distinct Unicode JSON keys replays its saved refusal (${JSON.stringify([firstKey, secondKey])})`, async () => {
    await withBackend(async (url) => {
      const key = randomUUID();
      const first = {
        name: "Тип",
        durationMinutes: 30,
        extra: { [firstKey]: 1, [secondKey]: 2 },
      };
      const reordered = {
        extra: { [secondKey]: 2, [firstKey]: 1 },
        durationMinutes: 30,
        name: "Тип",
      };
      const response = await post(url, key, first);
      expect(response.status).toBe(422);
      const saved = await response.json();
      const repeat = await post(url, key, reordered);
      expect(repeat.status).toBe(422);
      expect(await repeat.json()).toEqual(saved);
      expect(
        (
          await post(url, key, {
            ...first,
            extra: { [firstKey]: 2, [secondKey]: 2 },
          })
        ).status,
      ).toBe(409);
      expect(await (await post(url, key, first)).json()).toEqual(saved);
      expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
        data: [],
      });
    });
  });
}

for (const raw of [
  '{"name":"Тип","durationMinutes":1e400}',
  '{"name":"Тип","durationMinutes":30,"extra":{"nested":[-1e400]}}',
]) {
  test(`non-finite parsed numbers remain uninterpretable and never register an attempt: ${raw}`, async () => {
    await withBackend(async (url) => {
      const key = randomUUID();
      const overflow = () =>
        fetch(`${url}/api/event-types`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": key,
          },
          body: raw,
        });
      const response = await overflow();
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        outcome: "unknown",
        error: { code: "INVALID_REQUEST" },
      });
      const nullPayload = { name: "Тип", durationMinutes: null };
      const refused = await post(url, key, nullPayload);
      expect(refused.status).toBe(422);
      const saved = await refused.json();
      const afterSaved = await overflow();
      expect(afterSaved.status).toBe(400);
      expect(await afterSaved.json()).toMatchObject({
        outcome: "unknown",
        error: { code: "INVALID_REQUEST" },
      });
      expect(await (await post(url, key, nullPayload)).json()).toEqual(saved);
      expect(
        (await post(url, key, { name: "Тип", durationMinutes: 30 })).status,
      ).toBe(409);
      expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
        data: [],
      });
    });
  });
}
