import type { Page } from "@playwright/test";
import { expect, test } from "../support/browser.ts";

test("гость проходит путь записи на экране шириной 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Календарь звонков" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Выберите удобное время для встречи" }),
  ).toBeVisible();
  await expect(
    page.getByText("Без регистрации", { exact: true }),
  ).toBeVisible();
  const steps = page.getByRole("list", { name: "Как записаться на встречу" });
  for (const name of [
    "Выберите тип встречи",
    "Выберите день и время",
    "Укажите имя и email",
  ]) {
    await expect(steps.getByRole("heading", { name })).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);

  const cards = await steps.getByRole("listitem").all();
  for (let index = 1; index < cards.length; index += 1) {
    const previous = await cards[index - 1].boundingBox();
    const current = await cards[index].boundingBox();
    expect(previous).not.toBeNull();
    expect(current).not.toBeNull();
    expect(current!.y).toBeGreaterThanOrEqual(previous!.y + previous!.height);
  }

  const bookingLink = page.getByRole("link", { name: "Записаться на встречу" });
  await bookingLink.scrollIntoViewIfNeeded();
  await expect(bookingLink).toBeInViewport({ ratio: 1 });
  await bookingLink.click();

  await expect(page).toHaveURL("/booking");
  await expect(
    page.getByRole("heading", { name: "Запись на встречу", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Типов встреч пока нет. Обновите список позже.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const homeLink = page.getByRole("link", { name: "На главную", exact: true });
  await expect(homeLink).toBeInViewport({ ratio: 1 });
  await homeLink.click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Выберите удобное время для встречи" }),
  ).toBeVisible();
});

async function followLinkWithKeyboard(page: Page, name: string, path: string) {
  const link = page.getByRole("link", { name, exact: true });
  const controlCount = await page
    .getByRole("link")
    .or(page.getByRole("button"))
    .count();
  for (let attempt = 0; attempt <= controlCount; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }

  await expect(link).toBeFocused();
  await expect(link).toBeInViewport({ ratio: 1 });
  await expect(link).toHaveCSS("outline-style", /solid|dashed|dotted|double/);
  await expect(link).not.toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  expect(
    await link.evaluate((element) =>
      parseFloat(getComputedStyle(element).outlineWidth),
    ),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole("heading", {
      name:
        path === "/booking"
          ? "Запись на встречу"
          : "Выберите удобное время для встречи",
      level: 1,
    }),
  ).toBeVisible();
}

for (const width of [320, 1440]) {
  test(`гость достигает и активирует все ссылки с видимым фокусом при ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Выберите удобное время для встречи" }),
    ).toBeVisible();

    await followLinkWithKeyboard(page, "Календарь звонков", "/");
    await followLinkWithKeyboard(page, "Главная", "/");
    await followLinkWithKeyboard(page, "Запись", "/booking");
    await followLinkWithKeyboard(page, "Запись", "/booking");
    await followLinkWithKeyboard(page, "Главная", "/");
    await followLinkWithKeyboard(page, "Записаться на встречу", "/booking");
    await followLinkWithKeyboard(page, "Календарь звонков", "/");
    await followLinkWithKeyboard(page, "Записаться на встречу", "/booking");
    await followLinkWithKeyboard(page, "На главную", "/");
  });
}
