// Shared by creation forms. Keep the original payload until local completion
// succeeds, so a failed storage operation can always retry the same server attempt.
export type PendingAttempt<T> = { key: string; payload: T };
export function readAttempt<T>(
  name: string,
  valid: (value: unknown) => boolean,
): PendingAttempt<T> | undefined {
  const raw = sessionStorage.getItem(name);
  if (raw === null) return;
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value.key !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.key,
    ) ||
    !valid(value.payload)
  )
    throw new Error("Invalid local attempt");
  return value;
}
export function saveAttempt<T>(name: string, payload: T): PendingAttempt<T> {
  const attempt = { key: crypto.randomUUID(), payload };
  sessionStorage.setItem(name, JSON.stringify(attempt));
  return attempt;
}
export function completeAttempt(
  name: string,
  confirmation?: { name: string; value: unknown },
) {
  if (confirmation)
    sessionStorage.setItem(
      confirmation.name,
      JSON.stringify(confirmation.value),
    );
  sessionStorage.removeItem(name);
}
