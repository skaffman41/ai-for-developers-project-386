import { expect, test } from "../support/browser.ts";

test("гость узнаёт, как записаться на встречу без регистрации", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Календарь звонков" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Выберите удобное время для встречи",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Без регистрации", { exact: true }),
  ).toBeVisible();
  const steps = page.getByRole("list", { name: "Как записаться на встречу" });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.getByRole("listitem").nth(0)).toContainText(
    "Выберите тип встречи",
  );
  await expect(steps.getByRole("listitem").nth(1)).toContainText(
    "Выберите день и время",
  );
  await expect(steps.getByRole("listitem").nth(2)).toContainText(
    "Укажите имя и email",
  );
  await expect(
    page.getByRole("link", { name: "Записаться на встречу" }),
  ).toHaveAttribute("href", "/booking");
});

test("гость переходит к записи и возвращается с обычной историей браузера", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Записаться на встречу" }).click();

  await expect(page).toHaveURL("/booking");
  await expect(
    page.getByRole("heading", { name: "Запись на встречу", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Типов встреч пока нет. Обновите список позже.", {
      exact: true,
    }),
  ).toBeVisible();
  const homeLink = page.getByRole("link", { name: "На главную", exact: true });
  await expect(homeLink).toHaveAttribute("href", "/");

  await homeLink.click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Выберите удобное время для встречи" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Запись на встречу", level: 1 }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Выберите удобное время для встречи" }),
  ).toBeVisible();

  await page.goto("/booking");
  await expect(
    page.getByRole("heading", { name: "Запись на встречу", level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL("/booking");
  await expect(
    page.getByRole("heading", { name: "Запись на встречу", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Типов встреч пока нет. Обновите список позже.", {
      exact: true,
    }),
  ).toBeVisible();
});
