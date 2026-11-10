import { expect, test } from "../support/browser.ts";

test("owner creates a type with keyboard and guest reads the same record", async ({
  page,
  backend,
}, info) => {
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Календарь владельца", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Типов встреч пока нет. Создайте первый тип."),
  ).toBeVisible();
  await page.getByLabel("Название").fill("  Обсуждение проекта  ");
  await page.getByLabel("Длительность, минут").fill("45");
  await page.getByLabel("Описание", { exact: true }).fill("Планы\nи вопросы");
  await page.getByRole("button", { name: "Создать тип", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Тип встречи создан" }),
  ).toBeVisible();
  await expect(page.getByLabel("Название")).toHaveValue("");
  const response = await fetch(`${backend.url}/api/event-types`);
  const { data } = await response.json();
  expect(data).toHaveLength(1);
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    data[0].displayCode,
  );
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`owner-success-${width}.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    data[0].displayCode,
  );
  await page.getByRole("link", { name: "Запись", exact: true }).click();
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    "Обсуждение проекта",
  );
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    data[0].displayCode,
  );
});

for (const problem of [
  "before-save",
  "after-save",
  "malformed",
  "wrong-key",
  "wrong-outcome",
] as const) {
  test(`unknown ${problem} response locks the original fields and reload retries the same attempt`, async ({
    page,
    backend,
  }, info) => {
    const requests: { key: string; body: unknown }[] = [];
    await page.route("**/api/event-types", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      requests.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (problem === "before-save") {
        await route.abort();
        return;
      }
      const response = await route.fetch();
      if (problem === "after-save") {
        await route.abort();
        return;
      }
      if (problem === "malformed") {
        await route.fulfill({ response, body: "{broken" });
        return;
      }
      const json = await response.json();
      if (problem === "wrong-key")
        json.idempotencyKey = "11111111-1111-4111-8111-111111111111";
      if (problem === "wrong-outcome") {
        await route.fulfill({
          status: 409,
          json: {
            idempotencyKey: requests[0].key,
            outcome: "rejected",
            error: {
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "Чужая отправка",
            },
          },
        });
        return;
      }
      await route.fulfill({ response, json });
    });
    await page.goto("/owner");
    await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
    await page.getByLabel("Название").fill(" Разговор ");
    await page.getByLabel("Название").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Длительность, минут")).toBeFocused();
    await page.getByLabel("Длительность, минут").fill("45");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Описание", { exact: true })).toBeFocused();
    await page
      .getByRole("button", { name: "Создать тип", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Не удалось узнать результат создания типа",
    );
    await expect(page.getByLabel("Название")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Создать тип", exact: true }),
    ).toBeDisabled();
    if (problem === "after-save") {
      await page
        .getByRole("tab", { name: "Бронирования", exact: true })
        .click();
      await page.getByRole("button", { name: "Обновить бронирования" }).click();
      await expect(
        page.getByRole("button", { name: "Обновить бронирования" }),
      ).toBeEnabled();
      await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
      await expect(page.getByLabel("Название")).toHaveValue(" Разговор ");
      await expect(page.getByLabel("Длительность, минут")).toHaveValue("45");
      await expect(page.getByLabel("Название")).toBeDisabled();
      expect(requests).toHaveLength(1);
    }
    const { data } = await (
      await fetch(`${backend.url}/api/event-types`)
    ).json();
    expect(data).toHaveLength(problem === "before-save" ? 0 : 1);
    if (problem === "after-save") {
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: info.outputPath(`owner-unknown-${width}.png`),
          fullPage: true,
        });
      }
    }
    await page.reload();
    await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Не удалось узнать результат создания типа",
    );
    await expect(page.getByLabel("Название")).toHaveValue(" Разговор ");
    await page.unroute("**/api/event-types");
    page.on("request", (request) => {
      if (request.method() === "POST")
        requests.push({
          key: request.headers()["idempotency-key"],
          body: request.postDataJSON(),
        });
    });
    await page.getByRole("button", { name: "Повторить создание" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Тип встречи создан" }),
    ).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(
      (await (await fetch(`${backend.url}/api/event-types`)).json()).data,
    ).toHaveLength(1);
  });
}

test("overlong pasted text is retained with associated errors and focus on the first field", async ({
  page,
}, info) => {
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  const name = page.getByLabel("Название");
  await name.fill("я".repeat(101));
  await page.getByLabel("Длительность, минут").fill("541");
  await page.getByLabel("Описание", { exact: true }).fill("x".repeat(2001));
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(name).toHaveValue("я".repeat(101));
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#type-name-error")).toContainText("100");
  await expect(page.locator("#type-description-error")).toContainText("2000");
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(name).toHaveCSS("outline-style", "solid");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`owner-validation-${width}.png`),
      fullPage: true,
    });
  }
  await name.fill("Исправленный тип");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#type-name-error")).toHaveText("");
});

test("sessionStorage failure before saving prevents POST and retains the draft", async ({
  page,
  backend,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "call-calendar:createEventType")
        throw new Error("Storage unavailable");
      original.call(this, key, value);
    };
  });
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") posts += 1;
  });
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await page.getByLabel("Название").fill("Тип");
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Не удалось сохранить отправку" }),
  ).toBeVisible();
  await expect(page.getByLabel("Название")).toHaveValue("Тип");
  await expect(page.getByLabel("Название")).toBeEnabled();
  expect(posts).toBe(0);
  expect(
    (await (await fetch(`${backend.url}/api/event-types`)).json()).data,
  ).toEqual([]);
});

test("failed local completion preserves the original attempt for a safe reload retry", async ({
  page,
  backend,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (
        key === "call-calendar:createEventType" &&
        !this.getItem("remove-failed")
      ) {
        this.setItem("remove-failed", "yes");
        throw new Error("Storage unavailable");
      }
      original.call(this, key);
    };
  });
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await page.getByLabel("Название").fill("Тип");
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось узнать результат создания типа",
  );
  await page.reload();
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(page.getByLabel("Название")).toBeDisabled();
  await page.getByRole("button", { name: "Повторить создание" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Тип встречи создан" }),
  ).toBeVisible();
  expect(
    (await (await fetch(`${backend.url}/api/event-types`)).json()).data,
  ).toHaveLength(1);
});

test("a known validation refusal retains draft and allows a new independent key", async ({
  page,
}) => {
  const keys: string[] = [];
  await page.route("**/api/event-types", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    await route.fulfill({
      status: 422,
      json: {
        idempotencyKey: keys.at(-1),
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
  await page.getByLabel("Название").fill("Тип");
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(page.getByLabel("Название")).toBeFocused();
  await expect(page.getByLabel("Название")).toHaveValue("Тип");
  await expect(page.getByLabel("Название")).toBeEnabled();
  await page.getByLabel("Название").fill("Другой тип");
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(page.getByLabel("Название")).toBeFocused();
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test("older refresh cannot remove a just-created type or reset a filled form", async ({
  page,
}) => {
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(
    page.getByText("Типов встреч пока нет. Создайте первый тип."),
  ).toBeVisible();
  let release: () => void = () => {};
  let releasePost: () => void = () => {};
  let oldListFetched = false;
  let postSaved = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  await page.route("**/api/event-types", async (route) => {
    if (route.request().method() === "POST") {
      const response = await route.fetch();
      postSaved = true;
      await postGate;
      await route.fulfill({ response });
      return;
    }
    const response = await route.fetch();
    oldListFetched = true;
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "Обновить список" }).click();
    await expect.poll(() => oldListFetched).toBe(true);
    await page.getByLabel("Название").fill("Первый");
    await page.getByLabel("Длительность, минут").fill("45");
    await page.getByLabel("Описание", { exact: true }).fill("Исходные данные");
    await page
      .getByRole("button", { name: "Создать тип", exact: true })
      .click();
    await expect.poll(() => postSaved).toBe(true);
    await page.getByRole("tab", { name: "Бронирования", exact: true }).click();
    await page.getByRole("button", { name: "Обновить бронирования" }).click();
    await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
    await expect(page.getByLabel("Название")).toBeDisabled();
    await expect(page.getByLabel("Название")).toHaveValue("Первый");
    await expect(page.getByLabel("Длительность, минут")).toHaveValue("45");
    await expect(page.getByLabel("Описание", { exact: true })).toHaveValue(
      "Исходные данные",
    );
    releasePost();
    await expect(
      page.getByRole("status").filter({ hasText: "Тип встречи создан" }),
    ).toBeVisible();
    await page.getByLabel("Название").fill("Следующий");
  } finally {
    releasePost();
    release();
  }
  await expect(
    page.getByRole("button", { name: "Обновить список" }),
  ).toBeEnabled();
  await expect(page.getByRole("list", { name: "Типы встреч" })).toContainText(
    "Первый",
  );
  await expect(page.getByLabel("Название")).toHaveValue("Следующий");
});

test("independently filled tabs create separate types with separate attempt keys", async ({
  page,
  context,
  backend,
}) => {
  const other = await context.newPage();
  const keys: string[] = [];
  for (const tab of [page, other]) {
    tab.on("request", (request) => {
      if (request.method() === "POST")
        keys.push(request.headers()["idempotency-key"]);
    });
    await tab.goto("/owner");
    await tab.getByRole("tab", { name: "Типы встреч", exact: true }).click();
    await tab.getByLabel("Название").fill("Одинаковое название");
  }
  await Promise.all(
    [page, other].map((tab) =>
      tab.getByRole("button", { name: "Создать тип", exact: true }).click(),
    ),
  );
  for (const tab of [page, other])
    await expect(
      tab.getByRole("status").filter({ hasText: "Тип встречи создан" }),
    ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
  const { data } = await (await fetch(`${backend.url}/api/event-types`)).json();
  expect(data).toHaveLength(2);
  expect(data[0].id).not.toBe(data[1].id);
});

test("retrying an older saved success preserves the authoritative newest-first owner order", async ({
  page,
  backend,
}) => {
  await page.route("**/api/event-types", async (route) => {
    if (route.request().method() === "POST") {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.goto("/owner");
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  await expect(
    page.getByText("Типов встреч пока нет. Создайте первый тип."),
  ).toBeVisible();
  await page.getByLabel("Название").fill("Старый A");
  await page.getByRole("button", { name: "Создать тип", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось узнать результат создания типа",
  );
  const newer = await fetch(`${backend.url}/api/event-types`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ name: "Новый B", durationMinutes: 30 }),
  });
  expect(newer.status).toBe(201);
  await page.reload();
  await page.getByRole("tab", { name: "Типы встреч", exact: true }).click();
  const headings = page
    .getByRole("list", { name: "Типы встреч" })
    .getByRole("heading");
  await expect(headings).toHaveText(["Новый B", "Старый A"]);
  await page.unroute("**/api/event-types");
  await page
    .getByRole("button", { name: "Повторить создание", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Тип встречи создан" }),
  ).toBeVisible();
  await expect(headings).toHaveText(["Новый B", "Старый A"]);
  const { data } = await (await fetch(`${backend.url}/api/event-types`)).json();
  expect(data.map((value: { name: string }) => value.name)).toEqual([
    "Новый B",
    "Старый A",
  ]);
});
