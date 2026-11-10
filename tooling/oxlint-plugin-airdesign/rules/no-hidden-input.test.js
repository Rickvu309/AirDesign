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
const bypasses = [
  ["an aliased clock fails", `const now = Date.now\nexport const at = () => now()\n`, clock],
  ["a destructured clock fails", `const { now } = Date\nexport const at = () => now()\n`, clock],
  ["a destructured random fails", `const { random } = Math\nexport const pick = () => random()\n`, random],
  ["a globalThis clock fails", `export const at = () => globalThis.Date.now()\n`, clock],
  ["a computed clock fails", `export const at = () => Date["now"]()\n`, clock],
  ["a clock called through call fails", `export const at = () => Date.now.call(null)\n`, clock],
  ["Date without new fails", `export const at = () => Date()\n`, clock],
  ["globalThis.Date without new fails", `export const at = () => globalThis.Date()\n`, clock],
  ["performance.now fails", `export const at = () => performance.now()\n`, clock],
  ["Temporal.Now fails", `export const at = () => Temporal.Now.instant()\n`, clock],
  ["crypto.randomUUID fails", `export const id = () => crypto.randomUUID()\n`, random],
  [
    "window.crypto.getRandomValues fails",
    `export const fill = (bytes) => window.crypto.getRandomValues(bytes)\n`,
    random,
  ],
  [
    "an imported randomUUID fails",
    `import { randomUUID } from "node:crypto"\nexport const id = () => randomUUID()\n`,
    random,
  ],
  [
    "a renamed randomUUID fails",
    `import { randomUUID as mint } from "crypto"\nexport const id = () => mint()\n`,
    random,
  ],
  ["a passed tmpdir fails", `import { tmpdir } from "node:os"\nexport const folder = [tmpdir][0]\n`, folder],
  ["TMPDIR fails", `export const folder = () => process.env.TMPDIR\n`, folder],
]
for (const [name, source, message] of bypasses)
  expectRejects(name, "packages/document/src/probe.ts", source, rule, message)
expectRejects(
  "the old production worker is product code",
  "apps/site/worker/old-deployment-passthrough.ts",
  `export const at = () => Date.now()\n`,
  rule,
  clock,
)
expectRejects(
  "a clock call is not a seam even after ??",
  "apps/api/src/server.ts",
  `export const clock = (options) => options.now ?? Date.now()\n`,
  rule,
  clock,
)
expectAccepts(
  "the seam default stays: ?? Date.now as the option's fallback, as ApiOptions.now uses it",
  "apps/api/src/server.ts",
  `export const clock = (options) => options.now ?? Date.now\n`,
  rule,
)
expectAccepts(
  "the seam default stays: ?? randomUUID as the option's fallback, as ApiOptions.mint uses it",
  "apps/api/src/server.ts",
  `import { randomUUID } from "node:crypto"\nexport const mint = (options) => options.mint ?? randomUUID\n`,
  rule,
)
expectAccepts(
  "the seam default stays: a default parameter",
  "packages/mcp/src/admit.ts",
  `export const left = (resetsAt, now = Date.now) => resetsAt - now()\n`,
  rule,
)
expectAccepts(
  "a field named now stays",
  "packages/mcp/src/call.ts",
  `export const at = (session) => session.now\n`,
  rule,
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
