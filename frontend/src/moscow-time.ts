const formatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoscowTime(instant: string) {
  return formatter.format(new Date(instant));
}
