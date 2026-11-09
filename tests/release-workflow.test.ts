import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { test } from "vitest";

test("Release PR checks are dispatched for its current head instead of an old successful SHA", async () => {
  const workflow = parse(
    await readFile(".github/workflows/release-please.yml", "utf8"),
  );
  const script = workflow.jobs.release.steps.find(
    (step: { name?: string }) => step.name === "Check the current Release PR",
  ).with.script;
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const execute = new AsyncFunction(
    "github",
    "context",
    "core",
    "process",
    script,
  );
  const dispatched: unknown[] = [];
  const currentSha = "4444444444444444444444444444444444444444";
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: {
            state: "open",
            base: { ref: "main" },
            head: {
              ref: "release-please--branches--main",
              sha: currentSha,
              repo: { full_name: "fixture/calendar" },
            },
          },
        }),
      },
      actions: {
        createWorkflowDispatch: async (request: unknown) => {
          dispatched.push(request);
        },
      },
    },
  };
  await execute(
    github,
    { repo: { owner: "fixture", repo: "calendar" } },
    { info: () => {} },
    { env: { RELEASE_PRS: '[{"number":71,"sha":"old-sha"}]' } },
  );
  assert.deepEqual(dispatched, [
    {
      owner: "fixture",
      repo: "calendar",
      workflow_id: "app-check.yml",
      ref: "release-please--branches--main",
      inputs: { expected_sha: currentSha, release_pr: "71" },
    },
  ]);

  const check = parse(
    await readFile(".github/workflows/app-check.yml", "utf8"),
  );
  const steps = check.jobs.check.steps;
  const guard = steps.find(
    (step: { name?: string }) => step.name === "Verify the dispatched SHA",
  );
  assert.equal(
    spawnSync("bash", ["-c", guard.run], {
      env: { EXPECTED_SHA: currentSha, EVENT_SHA: "old-sha" },
    }).status,
    1,
  );
  assert.equal(
    spawnSync("bash", ["-c", guard.run], {
      env: { EXPECTED_SHA: currentSha, EVENT_SHA: currentSha },
    }).status,
    0,
  );
  const verify = new AsyncFunction(
    "github",
    "context",
    "core",
    "process",
    steps.find(
      (step: { name?: string }) =>
        step.name === "Verify the Release PR is still current",
    ).with.script,
  );
  await assert.rejects(
    verify(
      github,
      { repo: { owner: "fixture", repo: "calendar" } },
      { info: () => {} },
      { env: { EXPECTED_SHA: "old-sha", RELEASE_PR: "71" } },
    ),
    /changed/,
  );
  await verify(
    github,
    { repo: { owner: "fixture", repo: "calendar" } },
    { info: () => {} },
    { env: { EXPECTED_SHA: currentSha, RELEASE_PR: "71" } },
  );
});
