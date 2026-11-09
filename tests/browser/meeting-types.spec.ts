import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "../support/browser.ts";

async function observeState(page: Page, info: TestInfo, state: string) {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`${state}-${width}.png`),
      fullPage: true,
    });
  }
}

test("empty types can be refreshed with a keyboard and visible focus", async ({
  page,
}, info) => {
  await page.goto("/booking");
  await expect(page.getByRole("status")).toContainText("Типов встреч пока нет");
  await observeState(page, info, "empty");
  const refresh = page.getByRole("button", { name: "Обновить список" });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await refresh.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(refresh).toBeFocused();
  await expect(refresh).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Типов встреч пока нет");
});

test.describe("saved meeting types", () => {
  test.use({
    eventTypes: {
      values: [
        {
          id: "one",
          name: "Обсуждение проекта",
          durationMinutes: 45,
          description: "Задачи проекта\nи планы",
          createdAt: 100,
        },
        {
          id: "two",
          name: "Обсуждение проекта",
          durationMinutes: 30,
          createdAt: 100,
        },
      ],
    },
  });

  for (const width of [320, 1440]) {
    test(`shows saved details and stable distinct codes at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/booking");
      const items = page
        .getByRole("list", { name: "Типы встреч" })
        .getByRole("listitem");
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText("В-000002");
      await expect(items.nth(0)).toContainText("30 мин.");
      await expect(items.nth(0)).toContainText("Описание не указано");
      await expect(items.nth(1)).toContainText("В-000001");
      await expect(items.nth(1)).toContainText("45 мин.");
      await expect(items.nth(1)).toContainText("Задачи проекта");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`types-${width}.png`),
        fullPage: true,
      });
      await page.reload();
      await expect(items.nth(0)).toContainText("В-000002");
    });
  }

  test("announces loading before the real backend response arrives", async ({
    page,
  }, info) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/event-types", async (route) => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    try {
      await page.goto("/booking");
      await expect(page.getByRole("status")).toContainText(
        "Загружаем типы встреч",
      );
      await expect(
        page.getByRole("button", { name: "Обновить список" }),
      ).toBeDisabled();
      await observeState(page, info, "loading");
    } finally {
      release();
    }
    await expect(
      page.getByRole("list", { name: "Типы встреч" }).getByRole("listitem"),
    ).toHaveCount(2);
  });

  for (const problem of [
    "extra field",
    "string duration",
    "unicode line separator",
    "unicode paragraph separator",
    "wrong media type",
    "invalid error",
    "network",
  ] as const) {
    test(`rejects ${problem} and retries against the real backend`, async ({
      page,
    }, info) => {
      await page.route("**/api/event-types", async (route) => {
        if (problem === "network") {
          await route.abort();
          return;
        }
        const response = await route.fetch();
        const body = await response.json();
        if (problem === "extra field") body.data[0].extra = true;
        if (problem === "string duration") body.data[0].durationMinutes = "30";
        if (problem === "unicode line separator")
          body.data[0].name = "Разговор\u2028о проекте";
        if (problem === "unicode paragraph separator")
          body.data[0].name = "Разговор\u2029о проекте";
        if (problem === "invalid error") {
          await route.fulfill({
            response,
            status: 503,
            json: { data: body.data },
          });
          return;
        }
        await route.fulfill({
          response,
          json: body,
          contentType:
            problem === "wrong media type" ? "text/html" : "application/json",
        });
      });
      await page.goto("/booking");
      await expect(page.getByRole("alert")).toContainText(
        "Не удалось загрузить типы встреч",
      );
      await expect(page.getByRole("list", { name: "Типы встреч" })).toHaveCount(
        0,
      );
      if (problem === "string duration")
        await observeState(page, info, "error");
      await page.unroute("**/api/event-types");
      await page.getByRole("button", { name: "Повторить загрузку" }).click();
      await expect(
        page.getByRole("list", { name: "Типы встреч" }).getByRole("listitem"),
      ).toHaveCount(2);
    });
  }
});
