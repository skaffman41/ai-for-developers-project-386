import { writeFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/browser.ts";

test.use({ serverTime: "2026-11-09T05:00:00.000Z" });

async function activate(page: Page, control: Locator) {
  for (let step = 0; step < 100; step++) {
    if (await control.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press("Tab");
  }
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport({ ratio: 1 });
  await expect(control).toHaveCSS("outline-style", "solid");
  const href = await control.getAttribute("href");
  if (href)
    await Promise.all([
      page.waitForURL(new URL(href, page.url()).href),
      page.keyboard.press("Enter"),
    ]);
  else await page.keyboard.press("Enter");
}

for (const width of [320, 1440]) {
  test(`empty calendar completes owner → guest → owner through real API at ${width}px`, async ({
    page: owner,
    context,
    backend,
  }, info) => {
    await owner.setViewportSize({ width, height: 1000 });
    await owner.goto("/");
    await expect(
      owner.getByText("Онлайн-запись скоро появится", { exact: false }),
    ).toHaveCount(0);
    await activate(
      owner,
      owner.getByRole("link", { name: "Владельцу календаря", exact: true }),
    );
    await owner.reload();
    await expect(
      owner.getByRole("tab", { name: "Бронирования", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      (await (await fetch(`${backend.url}/api/event-types`)).json()).data,
    ).toEqual([]);
    expect(
      (
        await (
          await fetch(`${backend.url}/api/owner/bookings?period=all`)
        ).json()
      ).data,
    ).toEqual([]);
    await activate(
      owner,
      owner.getByRole("link", { name: "Главная", exact: true }),
    );
    await owner.goBack();
    await expect(owner).toHaveURL("/owner");
    await owner.goForward();
    await expect(owner).toHaveURL("/");
    await owner.goBack();
    await activate(
      owner,
      owner.getByRole("button", { name: "Создать первый тип" }),
    );
    await expect(owner.getByLabel("Название")).toBeFocused();
    await owner.keyboard.insertText("  Обсуждение проекта  ");
    await owner.keyboard.press("Tab");
    await expect(owner.getByLabel("Длительность, минут")).toBeFocused();
    await owner.keyboard.press("ControlOrMeta+A");
    await owner.keyboard.insertText("45");
    await owner.keyboard.press("Tab");
    await owner.keyboard.insertText("Планы и вопросы");
    const typeResponse = owner.waitForResponse(
      (response) =>
        response.url().endsWith("/api/event-types") &&
        response.request().method() === "POST",
    );
    await activate(
      owner,
      owner.getByRole("button", { name: "Создать тип", exact: true }),
    );
    const createdType = await typeResponse;
    expect(createdType.status()).toBe(201);
    const { data: eventType } = await createdType.json();
    expect(eventType).toMatchObject({
      name: "Обсуждение проекта",
      durationMinutes: 45,
      description: "Планы и вопросы",
    });
    await expect(owner.getByLabel("Название")).toHaveValue("");
    await activate(
      owner,
      owner.getByRole("tab", { name: "Типы встреч", exact: true }),
    );
    await owner.keyboard.press("ArrowLeft");
    await expect(
      owner.getByRole("tab", { name: "Бронирования", exact: true }),
    ).toBeFocused();
    await expect(
      owner.getByText("Предстоящих и текущих бронирований пока нет."),
    ).toBeVisible();

    const guest = await context.newPage();
    await guest.setViewportSize({ width, height: 1000 });
    await guest.goto("/booking");
    await guest.reload();
    await activate(
      guest,
      guest.getByRole("link", { name: "На главную", exact: true }),
    );
    await guest.goBack();
    await expect(guest).toHaveURL("/booking");
    await guest.goForward();
    await expect(guest).toHaveURL("/");
    await guest.goBack();
    await activate(
      guest,
      guest.getByRole("button", {
        name: `Выбрать Обсуждение проекта, ${eventType.displayCode}`,
      }),
    );
    await activate(
      guest,
      guest.getByRole("button", { name: "Выбрать дату и время" }),
    );
    await activate(
      guest,
      guest.getByRole("button", { name: "09:00–09:45", exact: true }),
    );
    await activate(
      guest,
      guest.getByRole("button", { name: "Указать контакты" }),
    );
    await expect(
      guest.getByRole("heading", { name: "Контакты", exact: true }),
    ).toBeFocused();
    await guest.keyboard.press("Tab");
    await expect(guest.getByLabel("Имя", { exact: true })).toBeFocused();
    await guest.keyboard.insertText("  Анна + Юлия  ");
    await guest.keyboard.press("Tab");
    await expect(guest.getByLabel("Email", { exact: true })).toBeFocused();
    await guest.keyboard.insertText("Anna.Test+tag@EXAMPLE.COM");
    await expect(
      guest.getByText("После подтверждения письмо на email не придёт.", {
        exact: false,
      }),
    ).toBeVisible();
    const bookingResponse = guest.waitForResponse(
      (response) =>
        response.url().endsWith("/api/bookings") &&
        response.request().method() === "POST",
    );
    await activate(
      guest,
      guest.getByRole("button", {
        name: "Подтвердить бронирование",
        exact: true,
      }),
    );
    const confirmed = await bookingResponse;
    expect(confirmed.status()).toBe(201);
    const { data: booking } = await confirmed.json();
    expect(booking).toEqual({
      id: expect.any(String),
      eventType,
      startsAt: "2026-11-09T06:00:00.000Z",
      endsAt: "2026-11-09T06:45:00.000Z",
      guestName: "Анна + Юлия",
      guestEmail: "Anna.Test+tag@example.com",
    });
    const heading = guest.getByRole("heading", {
      name: "Встреча забронирована",
    });
    await expect(heading).toBeFocused();
    await expect(
      guest.getByText(
        "Сохраните детали встречи с этого экрана. Письмо на email не придёт.",
      ),
    ).toBeVisible();
    await guest.reload();
    await expect(heading).toBeFocused();
    await expect(
      guest.getByText(booking.guestEmail, { exact: true }),
    ).toBeVisible();
    await activate(
      owner,
      owner.getByRole("button", { name: "Обновить бронирования" }),
    );
    const rows = owner.getByRole("list", { name: "Сохранённые бронирования" });
    await expect(rows.getByRole("listitem")).toHaveCount(1);
    for (const value of [
      eventType.name,
      eventType.displayCode,
      "45 мин.",
      "9 ноября 2026 г.",
      "09:00–09:45",
      "Europe/Moscow",
      booking.guestName,
      booking.guestEmail,
    ])
      await expect(rows).toContainText(value);
    const ownerResponse = await fetch(
      `${backend.url}/api/owner/bookings?period=all`,
    );
    expect(ownerResponse.status).toBe(200);
    const ownerBody = await ownerResponse.json();
    expect(ownerBody.data).toEqual([booking]);
    for (const [role, tab] of [
      ["owner", owner],
      ["confirmation", guest],
    ] as const) {
      expect(
        await tab.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await tab.screenshot({
        path: info.outputPath(`${role}-${width}.png`),
        fullPage: true,
      });
    }
    const recordsPath = info.outputPath("matching-real-api-records.json");
    await writeFile(
      recordsPath,
      JSON.stringify({ eventType, booking, ownerBody }, null, 2),
    );
    await info.attach("matching-real-api-records", {
      path: recordsPath,
      contentType: "application/json",
    });
    await owner.reload();
    await expect(rows).toContainText(booking.guestEmail);
    await guest.close();
  });
}
