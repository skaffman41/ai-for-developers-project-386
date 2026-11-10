import type { Page } from "@playwright/test";
import { expect, observe, test } from "../support/browser.ts";

test.use({
  eventTypes: {
    values: [
      { id: "discussion", name: "Обсуждение проекта", durationMinutes: 45 },
    ],
  },
  serverTime: "2026-11-09T05:00:00.000Z",
});
async function contacts(page: Page) {
  await page.goto("/booking");
  await page
    .getByRole("button", { name: "Выбрать Обсуждение проекта, В-000001" })
    .click();
  await page.getByRole("button", { name: "Выбрать дату и время" }).click();
  await page.getByRole("button", { name: "09:00–09:45" }).click();
  await page.getByRole("button", { name: "Указать контакты" }).click();
  await expect(page.getByRole("heading", { name: "Контакты" })).toBeFocused();
  await page.getByLabel("Имя", { exact: true }).fill("Анна + Юлия");
  await page.getByLabel("Email", { exact: true }).fill("Anna+tag@EXAMPLE.COM");
}
test("guest confirms real booking with keyboard and restores confirmation after reload", async ({
  page,
}, info) => {
  await contacts(page);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`contacts-${width}.png`),
      fullPage: true,
    });
  }
  const submit = page.getByRole("button", {
    name: "Подтвердить бронирование",
    exact: true,
  });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Встреча забронирована" }),
  ).toBeVisible();
  await expect(
    page.getByText("Anna+tag@example.com", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Встреча забронирована" }),
  ).toBeVisible();
});

for (const loss of [
  "before save",
  "after save",
  "invalid body",
  "different key",
  "invalid outcome",
  "wrong status",
] as const) {
  test(`unknown ${loss} locks original attempt and reload retries its exact key and payload`, async ({
    page,
    backend,
  }, info) => {
    await contacts(page);
    const sent: { key: string | undefined; body: unknown }[] = [];
    let first = true;
    await page.route("**/api/bookings", async (route) => {
      sent.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (!first) {
        await route.continue();
        return;
      }
      first = false;
      if (loss === "before save") {
        await route.abort();
        return;
      }
      const response = await route.fetch();
      if (loss === "after save") {
        await route.abort();
        return;
      }
      const json = await response.json();
      if (loss === "invalid body") delete json.data.endsAt;
      if (loss === "different key")
        json.idempotencyKey = "00000000-0000-4000-8000-000000000001";
      if (loss === "invalid outcome") {
        await route.fulfill({
          status: 422,
          json: {
            idempotencyKey: json.idempotencyKey,
            outcome: "unknown",
            error: { code: "VALIDATION_ERROR", message: "Ошибка" },
          },
        });
        return;
      }
      await route.fulfill({
        response,
        json,
        ...(loss === "wrong status" ? { status: 200 } : {}),
      });
    });
    await page
      .getByRole("button", { name: "Подтвердить бронирование", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Не удалось узнать результат бронирования",
    );
    await expect(page.getByRole("alert")).toContainText(
      "Бронирование могло быть сохранено. Повторите эту же попытку, чтобы узнать результат.",
    );
    if (loss === "after save") {
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: info.outputPath(`unknown-${width}.png`),
          fullPage: true,
        });
      }
    }
    await expect(page.getByLabel("Имя", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "1. Тип встречи" }),
    ).toBeDisabled();
    if (loss !== "before save")
      await backend.setTime("2027-01-01T00:00:00.000Z");
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(
      "Бронирование могло быть сохранено. Повторите эту же попытку, чтобы узнать результат.",
    );
    await expect(
      page.getByRole("button", { name: "Повторить подтверждение" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Повторить подтверждение" }).click();
    await expect(
      page.getByRole("heading", { name: "Встреча забронирована" }),
    ).toBeVisible();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
  });
}

test("failed initial sessionStorage write sends no HTTP and retains editable contacts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "call-calendar:createBooking")
        throw new Error("Controlled storage fault");
      return original.call(this, key, value);
    };
  });
  let posts = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/bookings")) posts++;
  });
  await contacts(page);
  await page
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Не удалось сохранить отправку",
  );
  expect(posts).toBe(0);
  await expect(page.getByLabel("Имя", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue(
    "Анна + Юлия",
  );
});

for (const fault of ["confirmation", "attempt removal"] as const)
  test(`failed local ${fault} keeps recoverable original context across reload`, async ({
    page,
    backend,
  }) => {
    await page.addInitScript((failure) => {
      const set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          failure === "confirmation" &&
          key === "call-calendar:bookingConfirmation" &&
          sessionStorage.getItem("storage-fault") !== "off"
        )
          throw new Error("Controlled confirmation fault");
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key) {
        if (
          failure === "attempt removal" &&
          key === "call-calendar:createBooking" &&
          sessionStorage.getItem("storage-fault") !== "off"
        )
          throw new Error("Controlled removal fault");
        return remove.call(this, key);
      };
    }, fault);
    const keys: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/bookings"))
        keys.push(request.headers()["idempotency-key"]!);
    });
    await contacts(page);
    await page
      .getByRole("button", { name: "Подтвердить бронирование", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Не удалось узнать результат бронирования",
    );
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("call-calendar:createBooking"),
      ),
    ).not.toBeNull();
    await backend.setTime("2027-01-01T00:00:00.000Z");
    await page.evaluate(() => sessionStorage.setItem("storage-fault", "off"));
    await page.reload();
    await page.getByRole("button", { name: "Повторить подтверждение" }).click();
    await expect(
      page.getByRole("heading", { name: "Встреча забронирована" }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

test("two independent tabs conflict, trap focus, Escape refreshes and preserves contacts despite a read failure", async ({
  page,
  context,
}, info) => {
  const other = await context.newPage();
  await contacts(page);
  await contacts(other);
  await other.getByLabel("Имя", { exact: true }).fill("Борис");
  const keys: string[] = [];
  for (const tab of [page, other])
    tab.on("request", (request) => {
      if (request.url().endsWith("/api/bookings"))
        keys.push(request.headers()["idempotency-key"]!);
    });
  await page
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Встреча забронирована" }),
  ).toBeVisible();
  await other.route("**/api/availability?**", (route) => route.abort());
  await other
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  const alert = other.getByRole("alertdialog", { name: "Слот уже занят" });
  await expect(alert).toBeVisible();
  const close = alert.getByRole("button", { name: "Выбрать другое время" });
  await expect(close).toBeFocused();
  await other.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await other.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  for (const width of [320, 1440]) {
    await other.setViewportSize({ width, height: 1000 });
    expect(
      await other.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await other.screenshot({
      path: info.outputPath(`conflict-${width}.png`),
      fullPage: true,
    });
  }
  await other.keyboard.press("Escape");
  await expect(alert).not.toBeVisible();
  await expect(
    other.getByRole("heading", { name: "Дата и время" }),
  ).toBeFocused();
  await expect(other.getByRole("alert")).toContainText(
    "Не удалось загрузить свободное время",
  );
  await expect(
    other.getByRole("group", { name: "Свободные интервалы" }),
  ).toHaveCount(0);
  await expect(
    other.getByRole("button", { name: "Повторить подтверждение" }),
  ).toHaveCount(0);
  await other.unroute("**/api/availability?**");
  await other
    .getByRole("button", { name: "Повторить загрузку времени" })
    .click();
  await expect(other.getByRole("button", { name: "09:00–09:45" })).toHaveCount(
    0,
  );
  await other.getByRole("button", { name: "10:00–10:45" }).click();
  await other.getByRole("button", { name: "Указать контакты" }).click();
  await expect(other.getByLabel("Имя", { exact: true })).toHaveValue("Борис");
  await expect(other.getByLabel("Email", { exact: true })).toHaveValue(
    "Anna+tag@EXAMPLE.COM",
  );
  await other
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(
    other.getByRole("heading", { name: "Встреча забронирована" }),
  ).toBeVisible();
  expect(new Set(keys).size).toBe(3);
  await other.close();
});

test("passed time has a distinct known refusal and retains contacts for another interval", async ({
  page,
  backend,
}) => {
  await contacts(page);
  await backend.setTime("2026-11-09T06:00:00.000Z");
  await page
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Выбранное время прошло");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "09:00–09:45" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "09:30–10:15" }).click();
  await page.getByRole("button", { name: "Указать контакты" }).click();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue(
    "Анна + Юлия",
  );
});

test("contact errors retain overlong input and focus the first error; back retains draft", async ({
  page,
}, info) => {
  await contacts(page);
  const name = page.getByLabel("Имя", { exact: true });
  await name.fill("я".repeat(101));
  await page.getByLabel("Email", { exact: true }).fill("bad");
  await page
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("я".repeat(101));
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", "guest-name-error");
  await expect(page.locator("#guest-name-error")).toContainText("100");
  await observe(page, info, "contact-validation");
  await name.fill("Анна");
  await page
    .getByRole("button", { name: "Подтвердить бронирование", exact: true })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Назад к дате и времени" }).click();
  await expect(
    page.getByRole("button", { name: "09:00–09:45" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Указать контакты" }).click();
  await expect(name).toHaveValue("Анна");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("bad");
});

test("double confirmation remains one in-flight immutable request", async ({
  page,
}, info) => {
  await contacts(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let posts = 0;
  await page.route("**/api/bookings", async (route) => {
    posts++;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Подтвердить бронирование", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Подтверждаем встречу",
    );
    await expect(page.getByLabel("Имя", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Подтвердить бронирование",
        exact: true,
      }),
    ).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(posts).toBe(1);
    await observe(page, info, "booking-sending");
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Встреча забронирована" }),
  ).toBeVisible();
});
