import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-hidden-input": "error" }
const clock = "Take the time as a `now` option, the way `ApiOptions.now` in apps/api/src/server.ts does."
const random = "Take randomness as an option, the way `ApiOptions.mint` in apps/api/src/server.ts does."
const folder = "Take the folder as an option. A shared temp folder leaks between runs."

expectRejects(
  "98a744f1 stamped queued commands with the clock",
  "packages/rpc/src/outbox.ts",
  `export const put = (item, index) => ({ pending: item, queuedAt: Date.now() + index })\n`,
  rule,
  clock,
)
expectRejects(
  "e84336fb wrote the build time into the build identity",
  "packages/operations/src/build-identity.ts",
  `export const identity = (sha) => ({ sha, builtAt: new Date().toISOString() })\n`,
  rule,
  clock,
)
expectRejects(
  "4e8e8951 jittered the schema wait with Math.random",
  "apps/server/src/db/history-schema-wait.ts",
  `export const retry = (remainingMs, ceiling) => Math.min(remainingMs, Math.round(ceiling / 2 + Math.random() * ceiling / 2))\n`,
  rule,
  random,
)
expectRejects(
  "a4dd7e83 left a shared temp folder to TLC",
  "packages/document/src/specs.ts",
  `import os from "node:os"\nexport const modules = () => os.tmpdir()\n`,
  rule,
  folder,
)
expectRejects(
  "a named tmpdir import fails",
  "apps/api/src/store.ts",
  `import { tmpdir } from "node:os"\nexport const folder = () => tmpdir()\n`,
  rule,
  folder,
)
expectAccepts(
  "the seam default stays",
  "apps/api/src/server.ts",
  `export const clock = (options) => options.now ?? Date.now\n`,
  rule,
)
expectAccepts(
  "a date from a value stays",
  "apps/web/src/decks/edited.ts",
  `export const edited = (updated) => new Date(updated).toISOString()\n`,
  rule,
)
expectAccepts(
  "a passed now stays",
  "packages/mcp/src/admit.ts",
  `export const left = (now, resetsAt) => resetsAt - now\n`,
  rule,
)
expectAccepts(
  "a test may read the clock",
  "packages/document/src/decide.rules.test.ts",
  `export const id = \`run\${Date.now().toString(36)}\${Math.random().toString(36)}\`\n`,
  rule,
)
expectAccepts("a script may read the clock", "scripts/judge.mjs", `export const started = Date.now()\n`, rule)
expectAccepts(
  "the tooling may use a temp folder",
  "tooling/oxlint-plugin-airdesign/harness.js",
  `import os from "node:os"\nexport const root = () => os.tmpdir()\n`,
  rule,
)
