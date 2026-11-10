import { expect, test } from "../support/browser.ts";

test.use({
  eventTypes: {
    values: [
      { id: "forty-five", name: "Обсуждение проекта", durationMinutes: 45 },
      { id: "short", name: "Короткая встреча", durationMinutes: 1 },
    ],
  },
  serverTime: "2026-11-09T05:00:00.000Z",
  timezoneId: "America/Los_Angeles",
});

test("guest explicitly chooses a type and Moscow interval with a wrong browser clock", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2035-01-01T00:00:00Z"));
  await page.goto("/booking");
  const next = page.getByRole("button", { name: "Выбрать дату и время" });
  await expect(next).toBeDisabled();
  await page
    .getByRole("button", { name: "Выбрать Обсуждение проекта, В-000001" })
    .click();
  await expect(page.getByRole("heading", { name: "Дата и время" })).toHaveCount(
    0,
  );
  await next.click();
  await expect(
    page.getByRole("heading", { name: "Дата и время" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "понедельник, 9 ноября 2026 г." }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "суббота, 14 ноября 2026 г." }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "09:00–09:45" })).toBeVisible();
  await expect(
    page.getByText("Europe/Moscow", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Выбрано:" }),
  ).toContainText("09:00–09:45");
  await expect(
    page.getByRole("button", { name: "Указать контакты" }),
  ).toBeDisabled();
});

async function openTime(page: import("@playwright/test").Page) {
  await page.goto("/booking");
  await page
    .getByRole("button", { name: "Выбрать Обсуждение проекта, В-000001" })
    .click();
  await page.getByRole("button", { name: "Выбрать дату и время" }).click();
  await expect(page.getByRole("button", { name: "09:00–09:45" })).toBeVisible();
}

async function observe(
  page: import("@playwright/test").Page,
  info: import("@playwright/test").TestInfo,
  state: string,
) {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`${state}-${width}.png`),
      fullPage: true,
    });
  }
}

test("back refetch hides old slots, preserves unchanged choices and clears dependent choices", async ({
  page,
}, info) => {
  await openTime(page);
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await page.getByRole("button", { name: "Назад к типам встреч" }).click();
  await expect(
    page.getByRole("button", { name: "1. Тип встречи" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Выбрать Обсуждение проекта, В-000001" }),
  ).toHaveAttribute("aria-pressed", "true");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/availability?**", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "Выбрать дату и время" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Загружаем свободное время",
    );
    await expect(
      page.getByRole("group", { name: "Свободные интервалы" }),
    ).toHaveCount(0);
    await expect(page.getByText("Выбрано:", { exact: false })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Указать контакты" }),
    ).toBeDisabled();
    await observe(page, info, "loading");
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "09:00–09:45" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.unroute("**/api/availability?**");
  await observe(page, info, "selected");
  await page
    .getByRole("button", { name: "вторник, 10 ноября 2026 г." })
    .click();
  await expect(
    page.getByRole("button", { name: "09:00–09:45" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Выбрано:", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await page.getByRole("button", { name: "1. Тип встречи" }).click();
  await page
    .getByRole("button", { name: "Выбрать Короткая встреча, В-000002" })
    .click();
  await page.getByRole("button", { name: "Выбрать дату и время" }).click();
  await expect(
    page.getByRole("button", { name: "вторник, 10 ноября 2026 г." }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "09:00–09:01" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("a returned date drops the selected interval after server time reaches its start", async ({
  page,
  backend,
}) => {
  await openTime(page);
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await page.getByRole("button", { name: "1. Тип встречи" }).click();
  await backend.setTime("2026-11-09T06:00:00.000Z");
  await page.getByRole("button", { name: "Выбрать дату и время" }).click();
  await expect(page.getByRole("button", { name: "09:30–10:15" })).toBeVisible();
  await expect(page.getByRole("button", { name: "09:00–09:45" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Выбрано:", { exact: false })).toHaveCount(0);
});

for (const problem of ["network", "invalid UTC interval"] as const) {
  test(`availability ${problem} hides old intervals and retries real HTTP`, async ({
    page,
  }, info) => {
    await openTime(page);
    await page.getByRole("button", { name: "09:00–09:45" }).click();
    await page.route("**/api/availability?**", async (route) => {
      if (problem === "network") {
        await route.abort();
        return;
      }
      const response = await route.fetch();
      const body = await response.json();
      body.data.slots[0].endsAt = "2026-11-10T09:45:00+03:00";
      await route.fulfill({ response, json: body });
    });
    await page
      .getByRole("button", { name: "вторник, 10 ноября 2026 г." })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Не удалось загрузить свободное время",
    );
    await expect(
      page.getByRole("group", { name: "Свободные интервалы" }),
    ).toHaveCount(0);
    await expect(page.getByText("Выбрано:", { exact: false })).toHaveCount(0);
    if (problem === "network") await observe(page, info, "error");
    await page.unroute("**/api/availability?**");
    await page
      .getByRole("button", { name: "Повторить загрузку времени" })
      .click();
    await expect(
      page.getByRole("button", { name: "09:00–09:45" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "вторник, 10 ноября 2026 г." }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

test.describe("no complete intervals today", () => {
  test.use({
    eventTypes: {
      values: [{ id: "long", name: "Длинная встреча", durationMinutes: 540 }],
    },
    serverTime: "2026-11-09T06:00:00.000Z",
  });
  test("empty availability offers another date and works entirely with the keyboard", async ({
    page,
  }, info) => {
    await page.goto("/booking");
    const choose = page.getByRole("button", {
      name: "Выбрать Длинная встреча, В-000001",
    });
    await choose.focus();
    await page.keyboard.press("Enter");
    const next = page.getByRole("button", { name: "Выбрать дату и время" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Дата и время" }),
    ).toBeFocused();
    await expect(page.getByRole("status")).toContainText(
      "свободного времени нет. Выберите другую дату или тип встречи",
    );
    await observe(page, info, "empty");
    const tomorrow = page.getByRole("button", {
      name: "вторник, 10 ноября 2026 г.",
    });
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "понедельник, 9 ноября 2026 г." }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tomorrow).toBeFocused();
    await expect(tomorrow).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    const interval = page.getByRole("button", { name: "09:00–18:00" });
    await expect(interval).toBeVisible();
    await interval.focus();
    await page.keyboard.press("Enter");
    await expect(interval).toHaveAttribute("aria-pressed", "true");
    await observe(page, info, "available");
  });
});

for (const failedRecovery of [false, true]) {
  test(`Moscow midnight refreshes expired choices${failedRecovery ? " after a failed recovery and retry" : ""}`, async ({
    page,
    backend,
  }, info) => {
    await openTime(page);
    await page.getByRole("button", { name: "09:00–09:45" }).click();
    await page.getByRole("button", { name: "1. Тип встречи" }).click();
    await backend.setTime("2026-11-09T21:01:00.000Z");
    let defaultReads = 0;
    const reads: { date: string | null; status: number }[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/availability?**", async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      const response = await route.fetch();
      reads.push({ date, status: response.status() });
      if (date === null) {
        defaultReads += 1;
        if (failedRecovery && defaultReads === 1) {
          await route.abort();
          return;
        }
        await gate;
      }
      await route.fulfill({ response });
    });
    try {
      await page.getByRole("button", { name: "Выбрать дату и время" }).click();
      if (failedRecovery) {
        await expect(page.getByRole("alert")).toContainText(
          "Не удалось загрузить свободное время",
        );
        await expect(
          page.getByRole("group", { name: "Выберите дату" }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "Повторить загрузку времени" })
          .click();
      }
      await expect.poll(() => defaultReads).toBe(failedRecovery ? 2 : 1);
      await expect(page.getByRole("status")).toContainText(
        "Загружаем свободное время",
      );
      await expect(
        page.getByRole("group", { name: "Свободные интервалы" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("group", { name: "Выберите дату" }),
      ).toHaveCount(0);
      await expect(page.getByText("Выбрано:", { exact: false })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Указать контакты" }),
      ).toBeDisabled();
    } finally {
      release();
    }
    await expect(
      page.getByRole("button", { name: "вторник, 10 ноября 2026 г." }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "понедельник, 9 ноября 2026 г." }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "понедельник, 23 ноября 2026 г." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "09:00–09:45" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(reads).toEqual([
      { date: "2026-11-09", status: 422 },
      { date: null, status: 200 },
      ...(failedRecovery ? [{ date: null, status: 200 }] : []),
    ]);
    if (failedRecovery) await observe(page, info, "midnight-recovered");
  });
}

test("Moscow midnight preserves a still-valid selected date and slot with fresh server bounds", async ({
  page,
  backend,
}) => {
  await openTime(page);
  await page
    .getByRole("button", { name: "вторник, 10 ноября 2026 г." })
    .click();
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await page.getByRole("button", { name: "1. Тип встречи" }).click();
  await backend.setTime("2026-11-09T21:01:00.000Z");
  const requests: (string | null)[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/availability?"))
      requests.push(new URL(request.url()).searchParams.get("date"));
  });
  await page.getByRole("button", { name: "Выбрать дату и время" }).click();
  await expect(
    page.getByRole("button", { name: "09:00–09:45" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "вторник, 10 ноября 2026 г." }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "понедельник, 9 ноября 2026 г." }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "понедельник, 23 ноября 2026 г." }),
  ).toBeVisible();
  expect(requests).toEqual(["2026-11-10"]);
});
