import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import {
  prepareDatabase,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

async function ownerFixture(
  run: (fixture: {
    url: string;
    setTime: (value: string) => Promise<void>;
  }) => Promise<void>,
  empty = false,
) {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    try {
      connection
        .prepare(
          "INSERT INTO event_types (id,name,duration_minutes,description,created_at) VALUES (?,?,?,?,?)",
        )
        .run("type", "Обсуждение", 45, "Вопросы проекта", 0);
      if (!empty)
        for (const [id, start, end] of [
          ["future", "2027-01-01T21:00:00Z", "2027-01-01T21:45:00Z"],
          ["current", "2026-11-09T06:00:00Z", "2026-11-09T06:45:00Z"],
          ["ended", "2026-11-09T05:15:00Z", "2026-11-09T06:00:00Z"],
          ["history", "2020-01-01T21:00:00Z", "2020-01-01T21:45:00Z"],
        ])
          connection
            .prepare(
              "INSERT INTO bookings (id,event_type_id,starts_at,ends_at,guest_name,guest_email) VALUES (?,?,?,?,?,?)",
            )
            .run(
              id!,
              "type",
              Date.parse(start!),
              Date.parse(end!),
              "Анна Петрова",
              "Anna+project@example.com",
            );
    } finally {
      connection.close();
    }
    const clock = join(database.directory, "clock.txt");
    await writeFile(clock, "2026-11-09T06:00:00.000Z");
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clock },
    });
    await run({
      url: backend.url,
      setTime: (value) => writeFile(clock, value),
    });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
}

test("owner periods use server end boundaries and retain whole history with canonical booking details", async () => {
  await ownerFixture(async ({ url, setTime }) => {
    async function get(query = "") {
      const response = await fetch(`${url}/api/owner/bookings${query}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-server-time")).toBe(
        "2026-11-09T06:00:00.000Z",
      );
      return (await response.json()).data;
    }
    const upcoming = await get();
    expect(upcoming.map((value: { id: string }) => value.id)).toEqual([
      "current",
      "future",
    ]);
    expect(upcoming[0]).toEqual({
      id: "current",
      eventType: {
        id: "type",
        name: "Обсуждение",
        durationMinutes: 45,
        description: "Вопросы проекта",
        displayCode: "В-000001",
      },
      startsAt: "2026-11-09T06:00:00.000Z",
      endsAt: "2026-11-09T06:45:00.000Z",
      guestName: "Анна Петрова",
      guestEmail: "Anna+project@example.com",
    });
    expect(await get("?period=upcoming")).toEqual(upcoming);
    expect(
      (await get("?period=past")).map((value: { id: string }) => value.id),
    ).toEqual(["ended", "history"]);
    expect(
      (await get("?period=all")).map((value: { id: string }) => value.id),
    ).toEqual(["history", "ended", "current", "future"]);
    await setTime("2026-11-09T06:44:59.999Z");
    expect(
      (await (await fetch(`${url}/api/owner/bookings`)).json()).data.map(
        (value: { id: string }) => value.id,
      ),
    ).toEqual(["current", "future"]);
    await setTime("2026-11-09T06:45:00.000Z");
    expect(
      (await (await fetch(`${url}/api/owner/bookings`)).json()).data.map(
        (value: { id: string }) => value.id,
      ),
    ).toEqual(["future"]);
    expect(
      (
        await (await fetch(`${url}/api/owner/bookings?period=past`)).json()
      ).data.map((value: { id: string }) => value.id),
    ).toEqual(["current", "ended", "history"]);
  });
});

test("empty owner periods succeed while invalid, duplicate and extra parameters are rejected strictly", async () => {
  await ownerFixture(async ({ url }) => {
    for (const query of [
      "",
      "?period=upcoming",
      "?period=past",
      "?period=all",
    ]) {
      const response = await fetch(`${url}/api/owner/bookings${query}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    }
    for (const query of [
      "?period=",
      "?period=UPCOMING",
      "?period=other",
      "?unused=1",
      "?period=all&unused=1",
      "?period=all&period=past",
      "?period[]=all",
    ]) {
      const response = await fetch(`${url}/api/owner/bookings${query}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "INVALID_REQUEST" },
      });
    }
    const types = await fetch(`${url}/api/event-types`);
    expect(types.headers.get("x-server-time")).toBe("2026-11-09T06:00:00.000Z");
  }, true);
});
