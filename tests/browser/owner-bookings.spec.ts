import { expect, test } from "../support/browser.ts";

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

test.use({
  eventTypes: {
    values: [
      {
        id: "type",
        name: "Обсуждение проекта",
        durationMinutes: 45,
        description: "Вопросы",
      },
    ],
  },
  serverTime: "2026-11-09T06:00:00.000Z",
  timezoneId: "America/Los_Angeles",
  bookings: [
    [
      {
        eventTypeId: "type",
        startsAt: "2027-01-01T21:00:00Z",
        endsAt: "2027-01-01T21:45:00Z",
      },
      {
        eventTypeId: "type",
        startsAt: "2026-11-09T06:00:00Z",
        endsAt: "2026-11-09T06:45:00Z",
      },
      {
        eventTypeId: "type",
        startsAt: "2020-01-01T21:00:00Z",
        endsAt: "2020-01-01T21:45:00Z",
      },
    ],
    { scope: "test" },
  ],
});

test("owner opens upcoming bookings and navigates periods and persistent tabs by keyboard using server time", async ({
  page,
  backend,
}, info) => {
  await page.clock.setFixedTime(new Date("2035-01-01T00:00:00Z"));
  await page.goto("/owner");
  const bookings = page.getByRole("tabpanel", {
    name: "Бронирования",
    exact: true,
  });
  await expect(
    page.getByRole("tab", { name: "Бронирования", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const rows = bookings
    .getByRole("list", { name: "Сохранённые бронирования" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Текущая");
  await expect(rows.first()).toContainText("09:00–09:45");
  await expect(rows.first()).toContainText("45 мин.");
  await expect(rows.first()).toContainText("guest@example.com");
  await expect(rows.last()).toContainText("Предстоящая");
  await expect(rows.last()).toContainText("2 января 2027");
  await expect(bookings.getByRole("status")).toContainText(
    "09.11.2026, 09:00:00",
  );
  await bookings.getByLabel("Период").selectOption("all");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Завершившаяся");
  await expect(rows.first()).toContainText("2 января 2020");
  await observe(page, info, "owner-history");
  const tab = page.getByRole("tab", { name: "Бронирования", exact: true });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Типы встреч", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Название")).toBeVisible();
  await page.getByLabel("Название").fill("Следующий тип");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(tab).toBeFocused();
  await bookings.getByLabel("Период").selectOption("past");
  await expect(rows).toHaveCount(1);
  await backend.setTime("2026-11-09T06:45:00.000Z");
  await bookings.getByRole("button", { name: "Обновить бронирования" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Завершившаяся");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Следующий тип");
});

test("a final type refusal received in another tab focuses its preserved error when the form is reopened", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posted = false;
  await page.route("**/api/event-types", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posted = true;
    await gate;
    await route.fulfill({
      status: 422,
      json: {
        idempotencyKey: route.request().headers()["idempotency-key"],
        outcome: "rejected",
        error: {
          code: "VALIDATION_ERROR",
          message: "Проверьте название",
          fieldErrors: { name: "Укажите другое название" },
        },
      },
    });
  });
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await page.getByLabel("Название").fill("Сохранённый ввод");
  try {
    await page
      .getByRole("button", { name: "Создать тип", exact: true })
      .click();
    await expect.poll(() => posted).toBe(true);
    await page.getByRole("tab", { name: "Бронирования", exact: true }).click();
  } finally {
    release();
  }
  await expect(page.locator("#type-name-error")).toHaveText(
    "Укажите другое название",
  );
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Сохранённый ввод");
  await expect(page.getByLabel("Название")).toBeFocused();
});

test("bookings load and retry independently, preserve stale rows during refresh and reject an untrusted server clock", async ({
  page,
  backend,
}, info) => {
  let requests = 0;
  await page.route("**/api/owner/bookings?**", async (route) => {
    requests += 1;
    await route.abort();
  });
  await page.goto("/owner");
  const panel = page.getByRole("tabpanel", {
    name: "Бронирования",
    exact: true,
  });
  await expect(panel.getByRole("alert")).toContainText(
    "Не удалось загрузить бронирования",
  );
  await observe(page, info, "first-error");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    "Обсуждение проекта",
  );
  await page.getByLabel("Название").fill("Ввод сохранится");
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Многострочный\nчерновик");
  await page.getByRole("tab", { name: "Бронирования", exact: true }).click();
  expect(requests).toBe(1);
  await page.unroute("**/api/owner/bookings?**");
  await panel
    .getByRole("button", { name: "Повторить загрузку бронирований" })
    .click();
  const rows = panel
    .getByRole("list", { name: "Сохранённые бронирования" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await backend.setTime("2026-11-09T06:45:00.000Z");
  await page.route("**/api/owner/bookings?**", async (route) => {
    const response = await route.fetch();
    await gate;
    const headers = response.headers();
    delete headers["x-server-time"];
    await route.fulfill({ response, headers });
  });
  try {
    await panel.getByRole("button", { name: "Обновить бронирования" }).click();
    await expect(panel.getByRole("status")).toContainText(
      "Обновляем бронирования",
    );
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Текущая");
    await observe(page, info, "refreshing");
  } finally {
    release();
  }
  await expect(panel.getByRole("alert")).toContainText("Данные устарели");
  await expect(panel.getByRole("alert")).toContainText("09:00:00");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Текущая");
  await observe(page, info, "stale");
  await page.unroute("**/api/owner/bookings?**");
  await panel
    .getByRole("button", { name: "Повторить загрузку бронирований" })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(panel.getByRole("status")).toContainText("09:45:00");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Ввод сохранится");
  await expect(page.getByLabel("Описание", { exact: true })).toHaveValue(
    "Многострочный\nчерновик",
  );
});

test("type-list failure leaves bookings usable and its retry and failed refresh retain all draft fields", async ({
  page,
  backend,
}, info) => {
  await page.clock.setFixedTime(new Date("2035-01-01T00:00:00Z"));
  await page.route("**/api/event-types", (route) => route.abort());
  await page.goto("/owner");
  await expect(
    page.getByRole("list", { name: "Сохранённые бронирования" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  const list = page.getByRole("region", { name: "Список типов встреч" });
  await expect(list.getByRole("alert")).toContainText(
    "Не удалось загрузить типы встреч",
  );
  await expect(list.getByRole("alert")).not.toContainText("Данные устарели");
  await page.getByLabel("Название").fill("Черновик");
  await page.getByLabel("Длительность, минут").fill("123");
  await page.getByLabel("Описание", { exact: true }).fill("Заметки\nк встрече");
  await page.unroute("**/api/event-types");
  await list.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(list.getByRole("list", { name: "Типы встреч" })).toContainText(
    "Обсуждение проекта",
  );
  await expect(list.getByRole("status")).toContainText("09.11.2026, 09:00:00");
  await backend.setTime("2026-11-09T07:00:00.000Z");
  await page.route("**/api/event-types", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "x-server-time": "2035-01-01T00:00:00+00:00",
      },
    });
  });
  await list.getByRole("button", { name: "Обновить список" }).click();
  await expect(list.getByRole("alert")).toContainText("Данные устарели");
  await expect(list.getByRole("list", { name: "Типы встреч" })).toContainText(
    "Обсуждение проекта",
  );
  await expect(list.getByRole("alert")).toContainText("09:00:00");
  await observe(page, info, "types-stale");
  await page.unroute("**/api/event-types");
  await list.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(list.getByRole("status")).toContainText("10:00:00");
  await expect(page.getByLabel("Название")).toHaveValue("Черновик");
  await expect(page.getByLabel("Длительность, минут")).toHaveValue("123");
  await expect(page.getByLabel("Описание", { exact: true })).toHaveValue(
    "Заметки\nк встрече",
  );
});

test("the first bookings load announces progress while the independently loaded types remain usable", async ({
  page,
}, info) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/owner/bookings?**", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/owner");
    const panel = page.getByRole("tabpanel", {
      name: "Бронирования",
      exact: true,
    });
    await expect(panel.getByRole("status")).toContainText(
      "Загружаем бронирования",
    );
    await expect(panel.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(
      panel.getByRole("button", { name: "Обновить бронирования" }),
    ).toBeDisabled();
    await observe(page, info, "initial-loading");
    await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
    await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
      "Обсуждение проекта",
    );
    await page.getByLabel("Название").fill("Независимый ввод");
    await page.getByRole("tab", { name: "Бронирования", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText(
      "Загружаем бронирования",
    );
  } finally {
    release();
  }
  await expect(
    page
      .getByRole("list", { name: "Сохранённые бронирования" })
      .getByRole("listitem"),
  ).toHaveCount(2);
});

test.describe("empty owner", () => {
  test.use({ eventTypes: { values: [] }, bookings: [[], { scope: "test" }] });
  test("empty states guide the owner to the first type then to guest booking", async ({
    page,
  }, info) => {
    await page.goto("/owner");
    const first = page.getByRole("button", { name: "Создать первый тип" });
    await expect(first).toBeVisible();
    await observe(page, info, "empty-no-types");
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Название")).toBeFocused();
    await expect(page.getByLabel("Название")).toHaveCSS(
      "outline-style",
      "solid",
    );
    await page.getByLabel("Название").fill("Первый тип");
    await page
      .getByRole("button", { name: "Создать тип", exact: true })
      .click();
    await expect(
      page.getByText("Тип встречи создан", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Бронирования", exact: true }).click();
    await expect(
      page.getByText("Предстоящих и текущих бронирований пока нет."),
    ).toBeVisible();
    await expect(first).toHaveCount(0);
    await observe(page, info, "empty-with-types");
    const panel = page.getByRole("tabpanel", {
      name: "Бронирования",
      exact: true,
    });
    await panel
      .getByRole("link", { name: "Открыть запись гостя", exact: true })
      .click();
    await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
      "Первый тип",
    );
  });
});
