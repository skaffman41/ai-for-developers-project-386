import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GitHub, Manifest } from "release-please";
import { test } from "vitest";

const base = "de8d144a5c4f9fa9503ce803ca13eb9af9f7950c";
const feature = "1111111111111111111111111111111111111111";
const fix = "2222222222222222222222222222222222222222";
const pageInfo = { hasNextPage: false, endCursor: null };

test("release dry-run proposes one initial application release from the planning boundary", async () => {
  // Recreate the unreleased state even when this test runs inside a later Release PR.
  const files = new Map([
    [
      "release-please-config.json",
      await readFile("release-please-config.json", "utf8"),
    ],
    [".release-please-manifest.json", '{".":"0.0.0"}\n'],
    ["version.txt", "0.0.0\n"],
    ["CHANGELOG.md", "# Changelog\n"],
  ]);
  const requests: string[] = [];
  let pullState: "absent" | "open" | "merged" | "released" = "absent";
  let releaseTitle = "";
  let releaseBody = "";
  let releaseBranch = "";
  const blobs = [...files].map(([path, content]) => ({
    path,
    content,
    sha: createHash("sha1").update(content).digest("hex"),
  }));
  const github = await GitHub.create({
    owner: "release-fixture",
    repo: "calendar",
    defaultBranch: "main",
    apiUrl: "https://release-fixture.invalid",
    graphqlUrl: "https://release-fixture.invalid",
    token: "not-a-real-token",
    // All requests terminate here: no sockets, credentials, or publication.
    fetch: async (input: string, init: RequestInit) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://release-fixture.invalid");
      requests.push(`${init.method} ${url.pathname}`);
      if (url.pathname === "/graphql") {
        const query: { query: string } = JSON.parse(String(init.body));
        assert.match(query.query, /^query /);
        assert.match(
          query.query,
          /^query (pullRequestsSince|releases|mergedPullRequests)\(/,
          "Only the controlled read queries are supported",
        );
        const repository = query.query.includes("query pullRequestsSince")
          ? {
              ref: {
                target: {
                  history: {
                    pageInfo,
                    nodes: [
                      [fix, "fix: preserve confirmation"],
                      [feature, "feat: book a meeting"],
                      [base, "docs(plan): snapshot approved graph"],
                      [
                        "3333333333333333333333333333333333333333",
                        "feat: obsolete historical feature",
                      ],
                    ].map(([sha, message]) => ({
                      sha,
                      message,
                      associatedPullRequests: { nodes: [] },
                    })),
                  },
                },
              },
            }
          : query.query.includes("query releases")
            ? { releases: { nodes: [], pageInfo } }
            : { pullRequests: { nodes: [], pageInfo } };
        return Response.json({ data: { repository } });
      }
      assert.equal(init.method, "GET", "dry-run must never mutate GitHub");
      const prefix = "/repos/release-fixture/calendar/contents/";
      if (url.pathname.startsWith(prefix)) {
        const path = decodeURIComponent(url.pathname.slice(prefix.length));
        const content = files.get(path);
        return content === undefined
          ? Response.json({ message: "Not Found" }, { status: 404 })
          : Response.json({
              path,
              type: "file",
              sha: base,
              encoding: "base64",
              content: Buffer.from(content).toString("base64"),
            });
      }
      if (url.pathname.endsWith("/pulls")) {
        const visible =
          pullState !== "absent" &&
          (url.searchParams.get("state") === "open") === (pullState === "open");
        return Response.json(
          visible
            ? [
                {
                  number: 71,
                  title: releaseTitle,
                  body: releaseBody,
                  head: { ref: releaseBranch },
                  base: { ref: "main" },
                  merged_at:
                    pullState === "open" ? null : "2026-11-09T12:00:00Z",
                  merge_commit_sha: fix,
                  labels: [
                    {
                      name:
                        pullState === "released"
                          ? "autorelease: tagged"
                          : "autorelease: pending",
                    },
                  ],
                },
              ]
            : [],
        );
      }
      if (url.pathname.endsWith("/tags")) {
        return Response.json([]);
      }
      if (url.pathname.includes("/commits/")) {
        return Response.json({
          files: [{ filename: "backend/src/server.ts" }],
        });
      }
      if (url.pathname.includes("/git/trees/")) {
        return Response.json({
          tree: blobs.map(({ path, sha }) => ({
            path,
            sha,
            type: "blob",
            mode: "100644",
          })),
          truncated: false,
        });
      }
      if (url.pathname.includes("/git/blobs/")) {
        const blob = blobs.find(({ sha }) => url.pathname.endsWith(sha));
        assert.ok(blob);
        return Response.json({
          content: Buffer.from(blob.content).toString("base64"),
          encoding: "base64",
        });
      }
      throw new Error(`Unexpected fixture request: ${init.method} ${url}`);
    },
  });
  const manifest = await Manifest.fromManifest(github, "main");
  // The pinned CLI's --dry-run invokes these same public planning methods.
  const proposals = await manifest.buildPullRequests();
  assert.equal(proposals.length, 1);
  const proposal = proposals[0]!;
  assert.equal(proposal.version?.toString(), "0.1.0");
  assert.equal(proposal.headRefName, "release-please--branches--main");
  const changes = await github.buildChangeSet(proposal.updates, "main");
  assert.equal(changes.get("version.txt")?.content, "0.1.0\n");
  const changelog = changes.get("CHANGELOG.md")?.content ?? "";
  assert.match(changelog, /0\.1\.0/);
  assert.match(changelog, /book a meeting/);
  assert.match(changelog, /preserve confirmation/);
  assert.doesNotMatch(changelog, /obsolete historical feature/);
  assert.deepEqual([...changes.keys()].sort(), [
    ".release-please-manifest.json",
    "CHANGELOG.md",
    "version.txt",
  ]);
  const repeated = await manifest.buildPullRequests();
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0]?.headRefName, proposal.headRefName);
  assert.equal(repeated[0]?.version?.toString(), "0.1.0");
  assert.deepEqual(await manifest.buildReleases(), []);
  releaseTitle = proposal.title.toString();
  releaseBody = proposal.body.toString();
  releaseBranch = proposal.headRefName;
  pullState = "open";
  // A real repeat against the same existing PR is a no-op, with no write API allowed.
  assert.deepEqual(await manifest.createPullRequests(), []);
  pullState = "merged";
  const releases = await manifest.buildReleases();
  assert.equal(releases.length, 1);
  assert.equal(releases[0]?.tag.toString(), "v0.1.0");
  assert.equal(releases[0]?.sha, fix);
  assert.match(releases[0]?.notes ?? "", /book a meeting/);
  pullState = "released";
  assert.deepEqual(await manifest.buildReleases(), []);
  assert.ok(requests.length > 0);
});
