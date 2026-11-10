import type { DatabaseSync } from "node:sqlite";

export type AttemptResult = { status: number; body: unknown };
export type CommitStage = "beforeCommit" | "afterCommit";
export type AttemptOptions = { onCommitStage?: (stage: CommitStage) => void };

// JSON values, rather than property insertion order or normalized fields, define identity.
function identity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(identity).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${identity(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

// The synchronous callback must do no network work or await. No retry of the
// transaction body is safe after an uncertain COMMIT; the next HTTP retry looks up its key.
export function runAttempt(
  database: DatabaseSync,
  operation: string,
  key: string,
  raw: unknown,
  create: () => AttemptResult,
  options: AttemptOptions = {},
): AttemptResult {
  const payload = identity(raw);
  database.exec("BEGIN IMMEDIATE");
  try {
    const saved = database
      .prepare(
        "SELECT raw_payload, status, body FROM operation_results WHERE operation=? AND attempt_key=?",
      )
      .get(operation, key);
    let result: AttemptResult;
    if (saved) {
      result =
        saved.raw_payload === payload
          ? {
              status: Number(saved.status),
              body: JSON.parse(String(saved.body)),
            }
          : {
              status: 409,
              body: {
                idempotencyKey: key,
                outcome: "unknown",
                error: {
                  code: "IDEMPOTENCY_KEY_REUSED",
                  message: "Ключ уже использован с другими данными",
                },
              },
            };
    } else {
      result = create();
      database
        .prepare(
          "INSERT INTO operation_results(operation,attempt_key,raw_payload,status,body) VALUES (?,?,?,?,?)",
        )
        .run(
          operation,
          key,
          payload,
          result.status,
          JSON.stringify(result.body),
        );
    }
    options.onCommitStage?.("beforeCommit");
    database.exec("COMMIT");
    options.onCommitStage?.("afterCommit");
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  }
}
