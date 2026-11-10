import { DatabaseSync } from "node:sqlite";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  prepareDatabase,
  runNode,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

// Frozen v1 fixture: a database produced by the previously released local slice.
function prepareLegacy(path: string) {
  const database = new DatabaseSync(path);
  database.exec(`CREATE TABLE event_types (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 540),
  description TEXT CHECK (description IS NULL OR length(description) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
) STRICT`);
  database.exec("PRAGMA application_id=1128352817; PRAGMA user_version=1");
  database
    .prepare(
      "INSERT INTO event_types (id,name,duration_minutes,description,created_at) VALUES (?,?,?,?,?)",
    )
    .run("saved", "Сохранённый тип", 45, "Сохраняем описание", 100);
  database.close();
}

const savedSuccessKey = "11111111-1111-4111-8111-111111111111";
const savedRejectionKey = "22222222-2222-4222-8222-222222222222";
const savedType = {
  id: "saved",
  name: "Сохранённый тип",
  durationMinutes: 45,
  description: "Сохраняем описание",
  displayCode: "В-000001",
};
const savedSuccess = { idempotencyKey: savedSuccessKey, data: savedType };
const savedRejection = {
  idempotencyKey: savedRejectionKey,
  outcome: "rejected",
  error: {
    code: "VALIDATION_ERROR",
    message: "Проверьте поля типа встречи",
    fieldErrors: { name: "Проверьте значение поля" },
  },
};

function resultRows(database: DatabaseSync) {
  return database
    .prepare("SELECT * FROM operation_results ORDER BY operation, attempt_key")
    .all();
}

// Frozen canonical #39 v2 schema and saved success/refusal fixtures.
function prepareVersionTwo(path: string) {
  prepareLegacy(path);
  const database = new DatabaseSync(path);
  try {
    database.exec(`CREATE TABLE operation_results (
  operation TEXT NOT NULL,
  attempt_key TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (operation, attempt_key)
) STRICT`);
    database.exec("PRAGMA user_version=2");
    const insert = database.prepare(
      "INSERT INTO operation_results(operation,attempt_key,raw_payload,status,body) VALUES (?,?,?,?,?)",
    );
    insert.run(
      "createEventType",
      savedSuccessKey,
      '{"description":"Сохраняем описание","durationMinutes":45,"name":"Сохранённый тип"}',
      201,
      JSON.stringify(savedSuccess),
    );
    insert.run(
      "createEventType",
      savedRejectionKey,
      '{"durationMinutes":30,"name":""}',
      422,
      JSON.stringify(savedRejection),
    );
    return resultRows(database);
  } finally {
    database.close();
  }
}

async function expectSavedReplays(url: string) {
  for (const attempt of [
    {
      key: savedSuccessKey,
      payload: {
        name: "Сохранённый тип",
        durationMinutes: 45,
        description: "Сохраняем описание",
      },
      status: 201,
      body: savedSuccess,
    },
    {
      key: savedRejectionKey,
      payload: { name: "", durationMinutes: 30 },
      status: 422,
      body: savedRejection,
    },
  ]) {
    const response = await fetch(`${url}/api/event-types`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": attempt.key,
      },
      body: JSON.stringify(attempt.payload),
    });
    expect(response.status).toBe(attempt.status);
    expect(await response.json()).toEqual(attempt.body);
  }
  expect(await (await fetch(`${url}/api/event-types`)).json()).toEqual({
    data: [savedType],
  });
}

test("v2→v3 preserves original type identity, success and rejection replays across restart", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    const before = prepareVersionTwo(database.path);
    backend = await startBackend(database.path);
    await expectSavedReplays(backend.url);
    await backend.stop();
    const connection = new DatabaseSync(database.path);
    try {
      expect(connection.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 3,
      });
      expect(resultRows(connection)).toEqual(before);
      expect(
        connection.prepare("SELECT count(*) AS count FROM bookings").get(),
      ).toEqual({ count: 0 });
    } finally {
      connection.close();
    }
    backend = await startBackend(database.path);
    await expectSavedReplays(backend.url);
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("failed v2→v3 migration rolls back schema/version while preserving saved attempts for recovery", async () => {
  const database = await temporaryDatabase();
  try {
    const before = prepareVersionTwo(database.path);
    const result = await runNode(
      [
        "--input-type=module",
        "-e",
        "import {openDatabase} from './backend/src/storage.ts'; openDatabase(process.env.DATABASE_PATH, {beforeMigrationCommit() {throw new Error('controlled v2 migration failure');}});",
      ],
      { DATABASE_PATH: database.path },
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("controlled v2 migration failure");
    const connection = new DatabaseSync(database.path);
    try {
      expect(connection.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 2,
      });
      expect(resultRows(connection)).toEqual(before);
      expect(
        connection
          .prepare(
            "SELECT name FROM sqlite_schema WHERE name IN ('bookings','bookings_interval')",
          )
          .all(),
      ).toEqual([]);
      expect(
        connection
          .prepare("SELECT id,name,duration_minutes FROM event_types")
          .all(),
      ).toEqual([
        { id: "saved", name: "Сохранённый тип", duration_minutes: 45 },
      ]);
    } finally {
      connection.close();
    }
    const backend = await startBackend(database.path);
    try {
      await expectSavedReplays(backend.url);
    } finally {
      await backend.stop();
    }
  } finally {
    await database.dispose();
  }
});

test("a supported v1 database upgrades transactionally, keeps type identity and reads persistent occupancy after restart", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    prepareLegacy(database.path);
    const clockPath = join(database.directory, "clock.txt");
    await writeFile(clockPath, "2026-11-09T05:00:00Z");
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clockPath },
    });
    const expected = {
      data: [
        {
          id: "saved",
          name: "Сохранённый тип",
          durationMinutes: 45,
          description: "Сохраняем описание",
          displayCode: "В-000001",
        },
      ],
    };
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual(expected);
    await backend.stop();
    const connection = new DatabaseSync(database.path);
    try {
      expect(connection.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 3,
      });
      expect(connection.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      connection
        .prepare(
          "INSERT INTO bookings (id,event_type_id,starts_at,ends_at,guest_name,guest_email) VALUES (?,?,?,?,?,?)",
        )
        .run(
          "saved-booking",
          "saved",
          Date.parse("2026-11-09T06:00:00Z"),
          Date.parse("2026-11-09T06:45:00Z"),
          "Гость",
          "guest@example.com",
        );
    } finally {
      connection.close();
    }
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clockPath },
    });
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual(expected);
    const availability = await (
      await fetch(`${backend.url}/api/availability?eventTypeId=saved`)
    ).json();
    expect(availability.data.slots[0]).toEqual({
      startsAt: "2026-11-09T07:00:00.000Z",
      endsAt: "2026-11-09T07:45:00.000Z",
    });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("failure before migration commit leaves the original schema, version and data intact and permits recovery", async () => {
  const database = await temporaryDatabase();
  try {
    prepareLegacy(database.path);
    const result = await runNode(
      [
        "--input-type=module",
        "-e",
        `import {openDatabase} from './backend/src/storage.ts'; openDatabase(process.env.DATABASE_PATH, {beforeMigrationCommit: () => { throw new Error('controlled migration failure'); }});`,
      ],
      { DATABASE_PATH: database.path },
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("controlled migration failure");
    const connection = new DatabaseSync(database.path);
    try {
      expect(connection.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 1,
      });
      expect(
        connection
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name",
          )
          .all(),
      ).toEqual([{ name: "event_types" }, { name: "sqlite_sequence" }]);
      expect(
        connection
          .prepare("SELECT id,name,duration_minutes FROM event_types")
          .all(),
      ).toEqual([
        { id: "saved", name: "Сохранённый тип", duration_minutes: 45 },
      ]);
    } finally {
      connection.close();
    }
    const backend = await startBackend(database.path);
    try {
      expect(
        (await (await fetch(`${backend.url}/api/event-types`)).json()).data[0]
          .id,
      ).toBe("saved");
    } finally {
      await backend.stop();
    }
  } finally {
    await database.dispose();
  }
});

test("fresh preparation contains no bookings or stored slots", async () => {
  const database = await temporaryDatabase();
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    try {
      expect(
        connection.prepare("SELECT count(*) AS count FROM bookings").get(),
      ).toEqual({ count: 0 });
      expect(
        connection
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%slot%'",
          )
          .all(),
      ).toEqual([]);
    } finally {
      connection.close();
    }
  } finally {
    await database.dispose();
  }
});
