import { chmod, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { request } from "node:http";
import { expect, test } from "vitest";
import {
  runNode,
  prepareDatabase,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

test("an explicitly prepared empty file serves an empty list of meeting types", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    backend = await startBackend(database.path);
    const response = await fetch(`${backend.url}/api/event-types`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("types retain normalized details, newest-first order and distinct stable codes after restart", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    try {
      const insert = connection.prepare(
        "INSERT INTO event_types (id, name, duration_minutes, description, created_at) VALUES (?, ?, ?, ?, ?)",
      );
      insert.run("older", "Первая встреча", 1, null, 100);
      insert.run("same-1", "Разговор", 45, "О проекте\nи планах", 200);
      insert.run("same-2", "Разговор", 540, null, 200);
    } finally {
      connection.close();
    }
    backend = await startBackend(database.path);
    const expected = {
      data: [
        {
          id: "same-2",
          name: "Разговор",
          durationMinutes: 540,
          displayCode: "В-000003",
        },
        {
          id: "same-1",
          name: "Разговор",
          durationMinutes: 45,
          description: "О проекте\nи планах",
          displayCode: "В-000002",
        },
        {
          id: "older",
          name: "Первая встреча",
          durationMinutes: 1,
          displayCode: "В-000001",
        },
      ],
    };
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual(expected);
    await backend.stop();
    backend = await startBackend(database.path);
    expect(
      await (await fetch(`${backend.url}/api/event-types`)).json(),
    ).toEqual(expected);
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test("read requests reject unknown query fields instead of silently removing them", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    backend = await startBackend(database.path);
    const response = await fetch(`${backend.url}/api/event-types?unused=1`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "Запрос не соответствует контракту",
      },
    });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

test.each(["\n", " ", "Разговор\u2028о проекте", "Разговор\u2029о проекте"])(
  "invalid stored name %j cannot become a successful HTTP response",
  async (name) => {
    const database = await temporaryDatabase();
    let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
    try {
      await prepareDatabase(database.path);
      const connection = new DatabaseSync(database.path);
      try {
        connection
          .prepare(
            "INSERT INTO event_types (id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
          )
          .run("invalid", name, 30, 1);
      } finally {
        connection.close();
      }
      backend = await startBackend(database.path);
      const response = await fetch(`${backend.url}/api/event-types`);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "Не удалось выполнить запрос",
        },
      });
    } finally {
      await backend?.stop();
      await database.dispose();
    }
  },
);

test("preparation is explicit and refuses to replace an existing database", async () => {
  const database = await temporaryDatabase();
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    try {
      connection
        .prepare(
          "INSERT INTO event_types (id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
        )
        .run("saved", "Сохранённый тип", 30, 1);
    } finally {
      connection.close();
    }
    const result = await runNode(["backend/src/prepare.ts"], {
      DATABASE_PATH: database.path,
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain("EEXIST");
    const backend = await startBackend(database.path);
    try {
      expect(
        await (await fetch(`${backend.url}/api/event-types`)).json(),
      ).toMatchObject({ data: [{ id: "saved" }] });
    } finally {
      await backend.stop();
    }
  } finally {
    await database.dispose();
  }
});

for (const kind of [
  "missing",
  "directory",
  "corrupt",
  "foreign",
  "unsupported",
  "altered",
  "unwritable",
] as const) {
  test(`backend refuses ${kind} database before serving HTTP without replacing the file`, async () => {
    const database = await temporaryDatabase();
    let path = database.path;
    try {
      if (kind === "directory") path = database.directory;
      if (kind === "corrupt") await writeFile(path, "This is not SQLite");
      if (kind === "foreign") {
        const connection = new DatabaseSync(path);
        connection.exec("CREATE TABLE another_app(x)");
        connection.close();
      }
      if (["unsupported", "altered", "unwritable"].includes(kind)) {
        await prepareDatabase(path);
        const connection = new DatabaseSync(path);
        try {
          if (kind === "unsupported")
            connection.exec("PRAGMA user_version=999");
          if (kind === "altered") connection.exec("DROP TABLE event_types");
        } finally {
          connection.close();
        }
        if (kind === "unwritable") await chmod(path, 0o400);
      }
      const before =
        kind !== "directory" ? await readFile(path).catch(() => null) : null;
      const result = await runNode(["backend/dist/server.js"], {
        DATABASE_PATH: path,
        HOST: "127.0.0.1",
        PORT: "0",
      });
      expect(result.code).toBe(1);
      expect(result.output).not.toContain("Server listening at");
      expect(result.output).toMatch(
        /ENOENT|regular SQLite file|not a database|unsupported database schema|EACCES/,
      );
      if (kind !== "directory")
        expect(await readFile(path).catch(() => null)).toEqual(before);
    } finally {
      if (kind === "unwritable") await chmod(path, 0o600);
      await database.dispose();
    }
  });
}

test("explicit preparation records schema version and all required durability settings", async () => {
  const database = await temporaryDatabase();
  try {
    await prepareDatabase(database.path);
    const result = await runNode(
      [
        "--input-type=module",
        "-e",
        `import {openDatabase} from './backend/src/storage.ts'; const db=openDatabase(process.env.DATABASE_PATH); const names=['application_id','user_version','journal_mode','synchronous','foreign_keys','busy_timeout',...(process.platform==='darwin'?['fullfsync']:[])]; console.log(JSON.stringify(Object.fromEntries(names.map(n=>[n,Object.values(db.prepare('PRAGMA '+n).get())[0]])))); db.close();`,
      ],
      { DATABASE_PATH: database.path },
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.output.trim())).toEqual({
      application_id: 1128352817,
      user_version: 1,
      journal_mode: "delete",
      synchronous: 3,
      foreign_keys: 1,
      busy_timeout: 5000,
      ...(process.platform === "darwin" ? { fullfsync: 1 } : {}),
    });
  } finally {
    await database.dispose();
  }
});

for (const path of ["/health", "/api/event-types"]) {
  test.each([
    {
      name: "JSON object",
      contentType: "application/json",
      payload: '{"unknown":1}',
      chunked: false,
    },
    {
      name: "malformed JSON",
      contentType: "application/json",
      payload: "{broken",
      chunked: false,
    },
    {
      name: "text",
      contentType: "text/plain",
      payload: "undeclared payload",
      chunked: false,
    },
    {
      name: "chunked JSON",
      contentType: "application/json",
      payload: '{"unknown":1}',
      chunked: true,
    },
  ])(
    `GET ${path} rejects an undeclared $name body on the real connection`,
    async ({ contentType, payload, chunked }) => {
      const database = await temporaryDatabase();
      let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
      try {
        await prepareDatabase(database.path);
        backend = await startBackend(database.path);
        const response = await new Promise<{
          status: number | undefined;
          body: unknown;
        }>((resolve, reject) => {
          const req = request(
            `${backend!.url}${path}`,
            {
              method: "GET",
              agent: false,
              signal: AbortSignal.timeout(5000),
              headers: {
                "content-type": contentType,
                ...(chunked
                  ? { "transfer-encoding": "chunked" }
                  : { "content-length": Buffer.byteLength(payload) }),
              },
            },
            (res) => {
              let body = "";
              res.setEncoding("utf8");
              res.on("data", (chunk: string) => {
                body += chunk;
              });
              res.once("error", reject);
              res.once("end", () => {
                try {
                  resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (error) {
                  reject(error);
                }
              });
            },
          );
          req.once("error", reject);
          req.end(payload);
        });
        expect(response).toEqual({
          status: 400,
          body: {
            error: {
              code: "INVALID_REQUEST",
              message: "Запрос не соответствует контракту",
            },
          },
        });
        const bodyless = await fetch(`${backend.url}${path}`, {
          headers: { "content-length": "0" },
        });
        expect(bodyless.status).toBe(200);
      } finally {
        await backend?.stop();
        await database.dispose();
      }
    },
  );
}
