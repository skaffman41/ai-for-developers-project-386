import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import {
  prepareDatabase,
  startBackend,
  temporaryDatabase,
} from "./support/backend.ts";

test("availability uses Moscow today and offers complete 45 minute intervals in the future", async () => {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    connection
      .prepare(
        "INSERT INTO event_types (id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
      )
      .run("forty-five", "Разговор", 45, 0);
    connection.close();
    const clockPath = join(database.directory, "clock.txt");
    await writeFile(clockPath, "2026-11-09T06:00:00.000Z");
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clockPath },
    });
    const response = await fetch(
      `${backend.url}/api/availability?eventTypeId=forty-five`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      eventTypeId: "forty-five",
      date: "2026-11-09",
      timeZone: "Europe/Moscow",
      firstDate: "2026-11-09",
      lastDate: "2026-11-22",
      asOf: "2026-11-09T06:00:00.000Z",
    });
    expect(body.data.slots).toHaveLength(16);
    expect(body.data.slots[0]).toEqual({
      startsAt: "2026-11-09T06:30:00.000Z",
      endsAt: "2026-11-09T07:15:00.000Z",
    });
    expect(body.data.slots.at(-1)).toEqual({
      startsAt: "2026-11-09T14:00:00.000Z",
      endsAt: "2026-11-09T14:45:00.000Z",
    });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
});

type Occupancy = { type: string; start: string; end: string };
async function withAvailability(
  now: string,
  durations: Record<string, number>,
  occupied: Occupancy[],
  run: (fixture: {
    url: string;
    setTime: (time: string) => Promise<void>;
  }) => Promise<void>,
) {
  const database = await temporaryDatabase();
  let backend: Awaited<ReturnType<typeof startBackend>> | undefined;
  try {
    await prepareDatabase(database.path);
    const connection = new DatabaseSync(database.path);
    try {
      for (const [id, duration] of Object.entries(durations))
        connection
          .prepare(
            "INSERT INTO event_types (id,name,duration_minutes,created_at) VALUES (?,?,?,?)",
          )
          .run(id, id, duration, 0);
      for (const [index, booking] of occupied.entries())
        connection
          .prepare(
            "INSERT INTO bookings (id,event_type_id,starts_at,ends_at,guest_name,guest_email) VALUES (?,?,?,?,?,?)",
          )
          .run(
            `booking-${index}`,
            booking.type,
            Date.parse(booking.start),
            Date.parse(booking.end),
            "Гость",
            "guest@example.com",
          );
    } finally {
      connection.close();
    }
    const clockPath = join(database.directory, "clock.txt");
    await writeFile(clockPath, now);
    backend = await startBackend(database.path, 0, {
      entry: "tests/support/clock-server.ts",
      env: { TEST_CLOCK_PATH: clockPath },
    });
    await run({
      url: backend.url,
      setTime: (time) => writeFile(clockPath, time),
    });
  } finally {
    await backend?.stop();
    await database.dispose();
  }
}

test("Moscow midnight changes the authoritative default date and inclusive horizon across a year", async () => {
  await withAvailability(
    "2026-12-31T20:59:59.999Z",
    { type: 30 },
    [],
    async ({ url, setTime }) => {
      const get = async (date = "") => {
        const response = await fetch(
          `${url}/api/availability?eventTypeId=type${date ? `&date=${date}` : ""}`,
        );
        return { status: response.status, body: await response.json() };
      };
      expect((await get()).body.data).toMatchObject({
        date: "2026-12-31",
        firstDate: "2026-12-31",
        lastDate: "2027-01-13",
        asOf: "2026-12-31T20:59:59.999Z",
        slots: [],
      });
      expect((await get("2027-01-13")).status).toBe(200);
      expect(await get("2027-01-14")).toMatchObject({
        status: 422,
        body: { error: { code: "TIME_UNAVAILABLE" } },
      });
      expect(await get("2026-12-30")).toMatchObject({
        status: 422,
        body: { error: { code: "TIME_UNAVAILABLE" } },
      });
      await setTime("2026-12-31T21:00:00.000Z");
      expect((await get()).body.data).toMatchObject({
        date: "2027-01-01",
        firstDate: "2027-01-01",
        lastDate: "2027-01-14",
        asOf: "2026-12-31T21:00:00.000Z",
      });
      expect((await get("2027-01-14")).status).toBe(200);
      expect(await get("2026-12-31")).toMatchObject({
        status: 422,
        body: { error: { code: "TIME_UNAVAILABLE" } },
      });
    },
  );
});

test.each([
  {
    duration: 1,
    count: 18,
    firstEnd: "2026-11-09T06:01:00.000Z",
    lastStart: "2026-11-09T14:30:00.000Z",
    lastEnd: "2026-11-09T14:31:00.000Z",
  },
  {
    duration: 30,
    count: 18,
    firstEnd: "2026-11-09T06:30:00.000Z",
    lastStart: "2026-11-09T14:30:00.000Z",
    lastEnd: "2026-11-09T15:00:00.000Z",
  },
  {
    duration: 540,
    count: 1,
    firstEnd: "2026-11-09T15:00:00.000Z",
    lastStart: "2026-11-09T06:00:00.000Z",
    lastEnd: "2026-11-09T15:00:00.000Z",
  },
])(
  "duration $duration is not rounded and its whole interval fits within 09:00–18:00",
  async ({ duration, count, firstEnd, lastStart, lastEnd }) => {
    await withAvailability(
      "2026-11-09T05:59:59.999Z",
      { type: duration },
      [],
      async ({ url, setTime }) => {
        const get = async () =>
          (
            await (
              await fetch(`${url}/api/availability?eventTypeId=type`)
            ).json()
          ).data.slots;
        const slots = await get();
        expect(slots).toHaveLength(count);
        expect(slots[0]).toEqual({
          startsAt: "2026-11-09T06:00:00.000Z",
          endsAt: firstEnd,
        });
        expect(slots.at(-1)).toEqual({ startsAt: lastStart, endsAt: lastEnd });
        await setTime("2026-11-09T06:00:00.000Z");
        expect(await get()).toHaveLength(count - 1);
        await setTime("2026-11-09T15:00:00.000Z");
        expect(await get()).toEqual([]);
      },
    );
  },
);

test.each(["2026-11-14", "2026-11-15"])(
  "weekend %s is a successful empty availability",
  async (date) => {
    await withAvailability(
      "2026-11-09T05:00:00Z",
      { type: 45 },
      [],
      async ({ url }) => {
        const response = await fetch(
          `${url}/api/availability?eventTypeId=type&date=${date}`,
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          data: { date, slots: [] },
        });
      },
    );
  },
);

test.each([
  "2026-11-31",
  "2026-02-29",
  "2026-13-01",
  "2026-00-09",
  "2026-11-00",
  "2026-11-9",
  "not-a-date",
  "",
])(
  "invalid or impossible date %j is rejected without rollover",
  async (date) => {
    await withAvailability(
      "2026-11-09T05:00:00Z",
      { type: 30 },
      [],
      async ({ url }) => {
        const response = await fetch(
          `${url}/api/availability?eventTypeId=type&date=${date}`,
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          error: { code: "VALIDATION_ERROR" },
        });
      },
    );
  },
);

test("full intervals conflict across types while either touching boundary remains available and reads reserve nothing", async () => {
  await withAvailability(
    "2026-11-09T05:00:00Z",
    { requested: 45, other: 15 },
    [
      {
        type: "other",
        start: "2026-11-09T06:45:00Z",
        end: "2026-11-09T07:00:00Z",
      },
      {
        type: "other",
        start: "2026-11-09T07:00:00Z",
        end: "2026-11-09T08:00:00Z",
      },
    ],
    async ({ url }) => {
      const get = async () => {
        const response = await fetch(
          `${url}/api/availability?eventTypeId=requested`,
        );
        expect(response.status).toBe(200);
        return response.json();
      };
      const first = await get();
      expect(first.data.slots.slice(0, 2)).toEqual([
        {
          startsAt: "2026-11-09T06:00:00.000Z",
          endsAt: "2026-11-09T06:45:00.000Z",
        },
        {
          startsAt: "2026-11-09T08:00:00.000Z",
          endsAt: "2026-11-09T08:45:00.000Z",
        },
      ]);
      expect(first.data.slots).toHaveLength(14);
      expect(await get()).toEqual(first);
    },
  );
});

test.each([
  { query: "", status: 400, code: "INVALID_REQUEST" },
  { query: "eventTypeId=type&unused=1", status: 400, code: "INVALID_REQUEST" },
  {
    query: "eventTypeId=type&eventTypeId=type",
    status: 400,
    code: "INVALID_REQUEST",
  },
  {
    query: "eventTypeId=type&date=2026-11-09&date=2026-11-10",
    status: 400,
    code: "INVALID_REQUEST",
  },
  { query: "eventTypeId=missing", status: 404, code: "EVENT_TYPE_NOT_FOUND" },
])(
  "availability rejects $query with its declared $code error",
  async ({ query, status, code }) => {
    await withAvailability(
      "2026-11-09T05:00:00Z",
      { type: 30 },
      [],
      async ({ url }) => {
        const response = await fetch(`${url}/api/availability?${query}`);
        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({ error: { code } });
      },
    );
  },
);
