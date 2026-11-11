import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-env-outside-entry": "error" }
const message = "Read the environment only by passing process.env whole"
const source = "apps/api/src/second.ts"
const read = `export const key = process.env.RESEND_API_KEY\n`
const startEntry = `import { readStartSettings } from "./start-settings.js"\nexport const settings = readStartSettings(process.env)\n`

expectRejects("0d00ff22 read the Resend key in mail.ts", "apps/api/src/mail.ts", read, rule, message)
expectRejects("the verifier's destructure fails", source, `export const { env } = process\n`, rule, message)
expectRejects(
  "a renamed destructure fails",
  source,
  `const { env: e } = process\nexport const k = e.KEY\n`,
  rule,
  message,
)
expectRejects(
  "the verifier's node:process import fails",
  source,
  `import { env } from "node:process"\nexport const k = env.KEY\n`,
  rule,
  message,
)
expectRejects("a process import fails", source, `import p from "process"\nexport const k = p.env.KEY\n`, rule, message)
expectRejects("the verifier's subfolder fails", "apps/api/src/deep/second.ts", read, rule, message)
expectRejects("an entry name in a subfolder fails", "apps/api/src/deep/start.ts", startEntry, rule, message)
expectRejects("a bracket read fails", source, `export const key = process["env"].KEY\n`, rule, message)
expectRejects("a template read fails", source, "export const key = process[`env`].KEY\n", rule, message)
expectRejects("a dynamic key fails", source, `export const read = (name) => process[name]\n`, rule, message)
expectRejects("a cast fails", source, `export const key = (process as any).env.KEY\n`, rule, message)
expectRejects("a globalThis read fails", source, `export const key = globalThis.process.env.KEY\n`, rule, message)
expectRejects(
  "process as a value fails",
  source,
  `const pick = (p) => p.env\nexport const env = pick(process)\n`,
  rule,
  message,
)
expectRejects(
  "a helper reading the environment fails",
  source,
  `export const read = () => process.env\n`,
  rule,
  message,
)
expectRejects(
  "an entry passing to a helper fails",
  "apps/api/src/start.ts",
  `const pick = (env) => env.KEY\nexport const key = pick(process.env)\n`,
  rule,
  message,
)
expectRejects(
  "an entry defining its own reader fails",
  "apps/api/src/start.ts",
  `const readStartSettings = (env) => env.KEY\nexport const key = readStartSettings(process.env)\n`,
  rule,
  message,
)
expectRejects(
  "an entry reading a property fails",
  "apps/api/src/start.ts",
  `${startEntry}export const key = process.env.KEY\n`,
  rule,
  message,
)
expectRejects(
  "an entry destructuring fails",
  "apps/api/src/setup.ts",
  `export const { env } = process\n`,
  rule,
  message,
)
expectRejects(
  "the wrong reader for the entry fails",
  "apps/api/src/setup.ts",
  `import { runBootstrap } from "./provision.js"\nawait runBootstrap(process.env)\n`,
  rule,
  message,
)
expectRejects(
  "the Postgres setup may not read a third name",
  "apps/api/src/postgres-setup.ts",
  `export const key = process.env.RESEND_API_KEY\n`,
  rule,
  message,
)
expectAccepts("start.ts passes the whole object", "apps/api/src/start.ts", startEntry, rule)
expectAccepts(
  "setup.ts passes the whole object",
  "apps/api/src/setup.ts",
  `import { runSetup } from "./provision.js"\nprocess.exitCode = await runSetup(process.env, (stream, line) => process[stream].write(line))\n`,
  rule,
)
expectAccepts(
  "bootstrap.ts passes the whole object",
  "apps/api/src/bootstrap.ts",
  `import { runBootstrap } from "./provision.js"\nprocess.exitCode = await runBootstrap(process.env, () => undefined)\n`,
  rule,
)
expectAccepts(
  "the Postgres setup reads its two names and copies the object",
  "apps/api/src/postgres-setup.ts",
  `export const a = process.env.LD_LIBRARY_PATH\nexport const b = process.env.AIRDESIGN_POSTGRES_BIN\nexport const copy = () => ({ ...process.env })\nexport const whole = () => { return process.env }\n`,
  rule,
)
expectAccepts("other process members stay", source, `export const here = process.cwd()\nprocess.exitCode = 1\n`, rule)
expectAccepts(
  "a reader's parameter stays",
  "apps/api/src/start-settings.ts",
  `export const read = (env) => env.KEY\n`,
  rule,
)
expectAccepts("a property named process stays", source, `export const ok = (job) => ({ process: job.process })\n`, rule)
expectAccepts("a type of process stays", source, `export type Env = typeof process.env\n`, rule)
expectAccepts("another package stays out of scope", "apps/web/src/second.ts", read, rule)
expectAccepts("a test file is out of scope", "apps/api/src/second.test.ts", read, rule)
