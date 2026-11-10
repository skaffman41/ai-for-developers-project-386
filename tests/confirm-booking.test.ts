import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  prepareDatabase,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

const now = "2026-11-09T05:00:00.000Z";
const raw = {
  eventTypeId: "",
  startsAt: "2026-11-09T06:00:00.000Z",
  guestName: "  Анна + Юлия  ",
  guestEmail: "  Anna.Example+tag@EXAMPLE.COM  ",
};
function post(
  url: string,
  key: string,
  payload: unknown,
  path = "/api/bookings",
) {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}
async function withBackend(
  run: (context: { url: string; path: string; clock: string }) => Promise<void>,
) {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const clock = join(database.directory, "clock");
    await writeFile(clock, now);
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clock },
    });
    await run({ url: backend.url, path: database.path, clock });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
}
async function type(url: string, durationMinutes = 45, key = randomUUID()) {
  return (
    await (
      await post(
        url,
        key,
        { name: "Разговор", durationMinutes },
        "/api/event-types",
      )
    ).json()
  ).data;
}

test("confirmation saves normalized contacts and full interval and replays after the meeting and horizon", async () => {
  await withBackend(async ({ url, clock }) => {
    const eventType = await type(url);
    const payload = { ...raw, eventTypeId: eventType.id };
    const key = randomUUID();
    const response = await post(url, key, payload);
    expect(response.status).toBe(201);
    const saved = await response.json();
    expect(saved).toEqual({
      idempotencyKey: key,
      data: {
        id: expect.any(String),
        eventType,
        startsAt: "2026-11-09T06:00:00.000Z",
        endsAt: "2026-11-09T06:45:00.000Z",
        guestName: "Анна + Юлия",
        guestEmail: "Anna.Example+tag@example.com",
      },
    });
    await writeFile(clock, "2027-01-01T00:00:00.000Z");
    const retry = await post(url, key, payload);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(saved);
  });
});

test("concurrent overlapping types have one winner, exact concurrent retries and touching boundaries", async () => {
  await withBackend(async ({ url, path }) => {
    const first = await type(url, 45),
      second = await type(url, 30);
    const candidates = [
      { ...raw, eventTypeId: first.id },
      { ...raw, eventTypeId: second.id, startsAt: "2026-11-09T06:30:00.000Z" },
    ];
    const keys = [randomUUID(), randomUUID()];
    const responses = await Promise.all(
      candidates.map((payload, index) => post(url, keys[index]!, payload)),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const winner = responses.findIndex((r) => r.status === 201),
      loser = 1 - winner;
    expect(bodies[loser]).toMatchObject({
      idempotencyKey: keys[loser],
      outcome: "rejected",
      error: { code: "SLOT_TAKEN" },
    });
    const retries = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(url, keys[winner]!, candidates[winner]),
      ),
    );
    expect(retries.map((r) => r.status)).toEqual(Array(6).fill(201));
    for (const retry of retries)
      expect(await retry.json()).toEqual(bodies[winner]);
    const end = bodies[winner].data.endsAt;
    expect(
      (
        await post(url, randomUUID(), {
          ...raw,
          eventTypeId: second.id,
          startsAt: end,
        })
      ).status,
    ).toBe(winner === 0 ? 422 : 201);
    const touch = await post(url, randomUUID(), {
      ...raw,
      eventTypeId: second.id,
      startsAt: "2026-11-09T07:00:00.000Z",
    });
    if (winner === 0) expect(touch.status).toBe(201);
    const { DatabaseSync } = await import("node:sqlite");
    const disk = new DatabaseSync(path);
    try {
      expect(
        disk.prepare("SELECT count(*) AS count FROM bookings").get(),
      ).toMatchObject({ count: 2 });
    } finally {
      disk.close();
    }
    expect(
      await (await post(url, keys[loser]!, candidates[loser])).json(),
    ).toEqual(bodies[loser]);
  });
});

test("raw values and operation namespace remain immutable while property order is irrelevant", async () => {
  await withBackend(async ({ url, path }) => {
    const key = randomUUID();
    const eventType = await type(url, 30, key);
    const payload = { ...raw, eventTypeId: eventType.id };
    const first = await post(url, key, payload);
    expect(first.status).toBe(201);
    const saved = await first.json();
    expect(
      await (
        await post(url, key, {
          guestEmail: payload.guestEmail,
          guestName: payload.guestName,
          startsAt: payload.startsAt,
          eventTypeId: payload.eventTypeId,
        })
      ).json(),
    ).toEqual(saved);
    for (const changed of [
      { ...payload, guestName: payload.guestName.trim() },
      { ...payload, guestEmail: "  Anna.Example+tag@example.com  " },
      { ...payload, extra: true },
    ]) {
      const response = await post(url, key, changed);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        outcome: "unknown",
        error: { code: "IDEMPOTENCY_KEY_REUSED" },
      });
    }
    expect(await (await post(url, key, payload)).json()).toEqual(saved);
    expect(
      (
        await post(url, randomUUID(), {
          ...payload,
          startsAt: "2026-11-09T06:30:00.000Z",
        })
      ).status,
    ).toBe(201);
    const { DatabaseSync } = await import("node:sqlite");
    const disk = new DatabaseSync(path);
    try {
      expect(disk.prepare("SELECT guest_email FROM bookings").all()).toEqual([
        { guest_email: "Anna.Example+tag@example.com" },
        { guest_email: "Anna.Example+tag@example.com" },
      ]);
    } finally {
      disk.close();
    }
  });
});

for (const changed of [
  null,
  [],
  {},
  { ...raw, guestName: 3 },
  { ...raw, guestEmail: 4 },
  { ...raw, guestName: " " },
  { ...raw, guestName: "А\nБ" },
  { ...raw, guestName: "А\u2028Б" },
  { ...raw, guestName: "я".repeat(101) },
  { ...raw, guestEmail: "no email" },
  { ...raw, guestEmail: "a".repeat(245) + "@example.com" },
  { ...raw, startsAt: "2026-02-30T06:00:00Z" },
  { ...raw, startsAt: "2026-11-09T09:00:00+03:00" },
  { ...raw, endsAt: "2026-11-09T06:45:00Z" },
]) {
  test(`strict booking input is a saved refusal: ${JSON.stringify(changed).slice(0, 100)}`, async () => {
    await withBackend(async ({ url }) => {
      const key = randomUUID();
      const response = await post(url, key, changed);
      expect(response.status).toBe(422);
      const saved = await response.json();
      expect(saved).toMatchObject({
        idempotencyKey: key,
        outcome: "rejected",
        error: { code: "VALIDATION_ERROR" },
      });
      expect(await (await post(url, key, changed)).json()).toEqual(saved);
    });
  });
}

for (const startsAt of [
  "2026-11-09T05:30:00.000Z",
  "2026-11-09T06:15:00.000Z",
  "2026-11-09T14:30:00.000Z",
  "2026-11-14T06:00:00.000Z",
  "2026-11-23T06:00:00.000Z",
]) {
  test(`confirmation rechecks complete working interval and horizon: ${startsAt}`, async () => {
    await withBackend(async ({ url, clock }) => {
      const eventType = await type(url, 45);
      const payload = { ...raw, eventTypeId: eventType.id, startsAt };
      const key = randomUUID();
      const response = await post(url, key, payload);
      expect(response.status).toBe(422);
      const saved = await response.json();
      expect(saved).toMatchObject({
        outcome: "rejected",
        error: { code: "TIME_UNAVAILABLE" },
      });
      await writeFile(clock, "2026-11-01T00:00:00.000Z");
      expect(await (await post(url, key, payload)).json()).toEqual(saved);
    });
  });
}

test("server time is rechecked at confirmation and missing type refusal is durable", async () => {
  await withBackend(async ({ url, clock }) => {
    const eventType = await type(url, 1);
    await writeFile(clock, "2026-11-09T06:00:00.000Z");
    const response = await post(url, randomUUID(), {
      ...raw,
      eventTypeId: eventType.id,
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "TIME_UNAVAILABLE" },
    });
    const key = randomUUID();
    const payload = { ...raw, eventTypeId: "missing" };
    const missing = await post(url, key, payload);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      outcome: "rejected",
      error: { code: "EVENT_TYPE_NOT_FOUND" },
    });
  });
});

test("Unicode contact limits are applied after trim without altering local email identity", async () => {
  await withBackend(async ({ url }) => {
    const eventType = await type(url, 540);
    const response = await post(url, randomUUID(), {
      ...raw,
      eventTypeId: eventType.id,
      guestName: `  ${"😀".repeat(100)}  `,
    });
    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({
      guestName: "😀".repeat(100),
      endsAt: "2026-11-09T15:00:00.000Z",
      guestEmail: "Anna.Example+tag@example.com",
    });
  });
});

for (const valid of [true, false])
  test(`failed atomic result save leaves unknown and safely retries (valid=${valid})`, async () => {
    await withBackend(async ({ url, path }) => {
      const eventType = await type(url);
      const { DatabaseSync } = await import("node:sqlite");
      const fault = new DatabaseSync(path);
      const key = randomUUID(),
        payload = {
          ...raw,
          eventTypeId: eventType.id,
          guestName: valid ? "Анна" : "",
        };
      try {
        fault.exec(
          "CREATE TRIGGER fail_booking_result BEFORE INSERT ON operation_results WHEN NEW.operation='createBooking' BEGIN SELECT RAISE(FAIL, 'Controlled result failure'); END",
        );
        const response = await post(url, key, payload);
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          idempotencyKey: key,
          outcome: "unknown",
          error: { code: "INTERNAL_ERROR" },
        });
        expect(
          fault.prepare("SELECT count(*) AS count FROM bookings").get(),
        ).toMatchObject({ count: 0 });
        expect(
          fault
            .prepare(
              "SELECT count(*) AS count FROM operation_results WHERE operation='createBooking'",
            )
            .get(),
        ).toMatchObject({ count: 0 });
        fault.exec("DROP TRIGGER fail_booking_result");
        const retry = await post(url, key, payload);
        expect(retry.status).toBe(valid ? 201 : 422);
        const saved = await retry.json();
        expect(await (await post(url, key, payload)).json()).toEqual(saved);
      } finally {
        fault.close();
      }
    });
  });

test("lock and uncertain COMMIT failures never claim slot conflict or a final refusal", async () => {
  await withBackend(async ({ url, path }) => {
    const eventType = await type(url);
    const { DatabaseSync } = await import("node:sqlite");
    const lock = new DatabaseSync(path);
    try {
      for (const mode of ["write", "read"]) {
        const key = randomUUID();
        const payload = {
          ...raw,
          eventTypeId: eventType.id,
          startsAt: mode === "read" ? "2026-11-09T07:00:00.000Z" : raw.startsAt,
        };
        lock.exec(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN");
        if (mode === "read") lock.prepare("SELECT * FROM bookings").all();
        const response = await post(url, key, payload);
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          outcome: "unknown",
          error: { code: "INTERNAL_ERROR" },
        });
        lock.exec("ROLLBACK");
        expect((await post(url, key, payload)).status).toBe(201);
      }
    } finally {
      if (lock.isTransaction) lock.exec("ROLLBACK");
      lock.close();
    }
  });
}, 15000);

test("invalid outgoing details roll back both booking and result before a successful retry", async () => {
  await withBackend(async ({ url, path }) => {
    const eventType = await type(url);
    const { DatabaseSync } = await import("node:sqlite");
    const disk = new DatabaseSync(path);
    try {
      disk
        .prepare("UPDATE event_types SET name = ? WHERE id = ?")
        .run("A\nB", eventType.id);
      const key = randomUUID(),
        payload = { ...raw, eventTypeId: eventType.id };
      const response = await post(url, key, payload);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ outcome: "unknown" });
      expect(
        disk.prepare("SELECT count(*) AS count FROM bookings").get(),
      ).toMatchObject({ count: 0 });
      disk
        .prepare("UPDATE event_types SET name = ? WHERE id = ?")
        .run("Исправленный тип", eventType.id);
      expect((await post(url, key, payload)).status).toBe(201);
    } finally {
      disk.close();
    }
  });
});

test.each([
  { stage: "beforeCommit", valid: true },
  { stage: "afterCommit", valid: true },
  { stage: "beforeCommit", valid: false },
  { stage: "afterCommit", valid: false },
])(
  "process stop at $stage preserves atomic booking/result and restart replay (valid=$valid)",
  async ({ stage, valid }) => {
    const { readFile } = await import("node:fs/promises");
    const { DatabaseSync } = await import("node:sqlite");
    const database = await temporaryDatabase();
    let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
    try {
      await prepareDatabase(database.path);
      const clock = join(database.directory, "clock"),
        marker = join(database.directory, "stage");
      await writeFile(clock, now);
      const disk = new DatabaseSync(database.path);
      disk
        .prepare(
          "INSERT INTO event_types(id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
        )
        .run("type", "Тип", 45, 0);
      disk.close();
      backend = await startBackend(database.path, 0, {
        entry: "tests/support/commit-backend.ts",
        env: {
          TEST_CLOCK_PATH: clock,
          STAGE_MARKER: marker,
          STOP_STAGE: stage,
        },
      });
      const key = randomUUID(),
        payload = {
          ...raw,
          eventTypeId: "type",
          guestName: valid ? raw.guestName : "",
        };
      const interrupted = post(backend.url, key, payload).catch(
        () => undefined,
      );
      await expect
        .poll(async () => readFile(marker, "utf8").catch(() => ""), {
          timeout: 5000,
        })
        .toBe(stage);
      backend.kill("SIGKILL");
      await backend.stop();
      await interrupted;
      const inspect = new DatabaseSync(database.path);
      try {
        expect(
          inspect.prepare("SELECT count(*) AS count FROM bookings").get(),
        ).toMatchObject({ count: stage === "afterCommit" && valid ? 1 : 0 });
        expect(
          inspect
            .prepare("SELECT count(*) AS count FROM operation_results")
            .get(),
        ).toMatchObject({ count: stage === "afterCommit" ? 1 : 0 });
      } finally {
        inspect.close();
      }
      backend = await startBackend(database.path, 0, {
        entry: "tests/support/clock-server.ts",
        env: { TEST_CLOCK_PATH: clock },
      });
      const response = await post(backend.url, key, payload);
      expect(response.status).toBe(valid ? 201 : 422);
      const saved = await response.json();
      await backend.stop();
      backend = await startBackend(database.path, 0, {
        entry: "tests/support/clock-server.ts",
        env: { TEST_CLOCK_PATH: clock },
      });
      expect(await (await post(backend.url, key, payload)).json()).toEqual(
        saved,
      );
    } finally {
      backend?.kill("SIGCONT");
      await backend?.stop();
      await database.dispose();
    }
  },
);

for (const startsAt of ["2016-12-31T23:59:60Z", "2026-11-09T06:00:00.0001Z"])
  test(`unrepresentable or fractional off-grid instant is a saved time refusal: ${startsAt}`, async () => {
    await withBackend(async ({ url }) => {
      const eventType = await type(url);
      const key = randomUUID(),
        payload = { ...raw, eventTypeId: eventType.id, startsAt };
      const response = await post(url, key, payload);
      expect(response.status).toBe(422);
      const saved = await response.json();
      expect(saved).toMatchObject({
        outcome: "rejected",
        error: { code: "TIME_UNAVAILABLE" },
      });
      expect(await (await post(url, key, payload)).json()).toEqual(saved);
    });
  });

test("simultaneous first submissions of one booking key create exactly one saved booking", async () => {
  await withBackend(async ({ url, path }) => {
    const eventType = await type(url, 30);
    const key = randomUUID(),
      payload = { ...raw, eventTypeId: eventType.id };
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => post(url, key, payload)),
    );
    expect(responses.map((response) => response.status)).toEqual(
      Array(8).fill(201),
    );
    const saved = await responses[0]!.json();
    for (const response of responses.slice(1))
      expect(await response.json()).toEqual(saved);
    const { DatabaseSync } = await import("node:sqlite");
    const disk = new DatabaseSync(path);
    try {
      expect(
        disk
          .prepare(
            "SELECT id,event_type_id,starts_at,ends_at,guest_name,guest_email FROM bookings",
          )
          .all(),
      ).toEqual([
        {
          id: saved.data.id,
          event_type_id: eventType.id,
          starts_at: 1794204000000,
          ends_at: 1794205800000,
          guest_name: "Анна + Юлия",
          guest_email: "Anna.Example+tag@example.com",
        },
      ]);
    } finally {
      disk.close();
    }
  });
});

test("booking request framing errors and non-finite JSON never register a final attempt", async () => {
  await withBackend(async ({ url, path }) => {
    const eventType = await type(url, 30);
    for (const body of [
      "{broken",
      '{"eventTypeId":"' +
        eventType.id +
        '","startsAt":1e400,"guestName":"Имя","guestEmail":"a@example.com"}',
    ]) {
      const key = randomUUID();
      const response = await fetch(`${url}/api/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        outcome: "unknown",
        error: { code: "INVALID_REQUEST" },
      });
      expect(
        (
          await post(url, key, {
            ...raw,
            eventTypeId: eventType.id,
            startsAt:
              body === "{broken" ? raw.startsAt : "2026-11-09T06:30:00.000Z",
          })
        ).status,
      ).toBe(201);
    }
    for (const key of ["", "invalid"]) {
      const response = await post(url, key, {
        ...raw,
        eventTypeId: eventType.id,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ outcome: "unknown" });
    }
    const { DatabaseSync } = await import("node:sqlite");
    const disk = new DatabaseSync(path);
    try {
      expect(
        disk
          .prepare(
            "SELECT count(*) AS count FROM operation_results WHERE operation='createBooking'",
          )
          .get(),
      ).toMatchObject({ count: 2 });
    } finally {
      disk.close();
    }
  });
});

test("zero fractional padding is an exact grid instant and raw spelling still defines replay identity", async () => {
  await withBackend(async ({ url }) => {
    const eventType = await type(url, 1),
      key = randomUUID();
    const payload = {
      ...raw,
      eventTypeId: eventType.id,
      startsAt: "2026-11-09T06:00:00.000000Z",
    };
    const response = await post(url, key, payload);
    expect(response.status).toBe(201);
    expect((await response.json()).data.startsAt).toBe(
      "2026-11-09T06:00:00.000Z",
    );
    const changed = await post(url, key, {
      ...payload,
      startsAt: "2026-11-09T06:00:00.000Z",
    });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({
      outcome: "unknown",
      error: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  });
});
