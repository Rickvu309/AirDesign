import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { overLimit, readSticks, timeStick } from "./sticks.mjs"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-sticks-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))

const write = (relative, source) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
}
const record = (faults) =>
  write(
    "sticks.json",
    JSON.stringify({
      "known faults": { now: faults, goal: 0 },
      "real decks in the PowerPoint check": { now: 1, goal: 20 },
      "routes pptx writes": { now: 2, goal: 3 },
      "check seconds": { limit: 40 },
      "PowerPoint check seconds": { limit: 90 },
    }),
  )
const faultCall = `it${".fails"}(`

write("packages/a/src/a.test.ts", `${faultCall}"one", () => {})\nit("two", () => {})\n`)
write(
  "scripts/pptx-fixtures/cases.json",
  JSON.stringify([
    { before: "a.pptx", after: "b.pptx" },
    { before: "a.pptx", after: "a.pptx" },
  ]),
)
write("scripts/pptx-fixtures/a.pptx", "x".repeat(100_000))
write("scripts/pptx-fixtures/b.pptx", "x")
write(
  "packages/document/dist/index.js",
  `export const properties = { shape: { box: { route: "xfrm" }, text: { route: "txBody" } }, kept: { box: { route: "xfrm" } } }
export const structure = { deck: {}, shape: { create: { route: "spTree.add" } } }
`,
)
write("packages/pptx/dist/index.js", 'export const writtenRoutes = { text: "txBody", move: "xfrm", resize: "xfrm" }\n')
record(1)
execFileSync("git", ["init", "-q"], { cwd: root })
execFileSync("git", ["add", "-A"], { cwd: root })

const steady = await readSticks(root)
if (steady.drift.length !== 0) throw new Error(`a matching record drifted\n${steady.drift.join("\n")}`)
if (steady.rows.find((row) => row.name === "known faults")?.now !== 1)
  throw new Error("one known fault was not counted")

write("packages/a/src/a.test.ts", `${faultCall}"one", () => {})\n${faultCall}"two", () => {})\n`)
if (steady.rows.find((row) => row.name === "check seconds")?.limit !== 40)
  throw new Error("a limit stick was not listed")

const capabilities = steady.rows.find((row) => row.name === "routes pptx writes")
if (capabilities?.now !== 2 || capabilities.goal !== 3)
  throw new Error(`distinct routes were not counted: ${JSON.stringify(capabilities)}`)

const slow = overLimit({ name: "check seconds", now: 41.2, limit: 40 })
if (slow !== "check seconds is 41.2 and its limit is 40. Make it faster.") throw new Error(`${slow}`)
if (overLimit({ name: "check seconds", now: 40, limit: 40 }) !== undefined)
  throw new Error("a time at the limit was reported")
const timed = timeStick(root, "check seconds", Date.now() - 41_200)
if (!/^stick check seconds  now 41\.\d  limit 40$/.test(timed.line)) throw new Error(timed.line)
if (!timed.over?.startsWith("check seconds is 41.")) throw new Error(`${timed.over}`)
if (timeStick(root, "check seconds", Date.now()).over !== undefined) throw new Error("a fast run was reported")
const gate = process.env.CI
for (const [value, fails] of [
  ["true", true],
  ["1", true],
  ["", false],
  ["false", false],
]) {
  process.env.CI = value
  if (timeStick(root, "check seconds", Date.now() - 81_200).fails !== fails) {
    throw new Error(`a time over twice its limit with CI=${value} should ${fails ? "fail" : "pass"}`)
  }
  if (timeStick(root, "check seconds", Date.now() - 48_400).fails) {
    throw new Error(`a time over its limit and under twice it must only warn, with CI=${value}`)
  }
}
if (gate === undefined) delete process.env.CI
else process.env.CI = gate
let unlimited = ""
try {
  timeStick(root, "nobody limits", Date.now())
} catch (error) {
  unlimited = error.message
}
if (unlimited !== "nobody limits has no limit in sticks.json.") throw new Error(`a missing limit passed: ${unlimited}`)

const added = (await readSticks(root)).drift
if (added.length !== 1 || added[0] !== "known faults is 2 and sticks.json says 1. Record 2 in sticks.json.") {
  throw new Error(`a new known fault must be recorded\n${added.join("\n")}`)
}

for (const hidden of [
  'it.skip("one", () => {})',
  'it.todo("one")',
  'it("one", { fails: true }, () => {})',
  'it.fails.each([1])("one", () => {})',
  'test.fixme("one", async () => {})',
  'test.describe.fixme("one", () => {})',
  'test.fail("one", async () => {})',
  "test.fail()",
]) {
  write("packages/a/src/a.spec.js", `${hidden}\n`)
  execFileSync("git", ["add", "-A"], { cwd: root })
  const seen = (await readSticks(root)).rows.find((row) => row.name === "known faults")?.now
  if (seen !== 3) throw new Error(`a hidden fault was not counted: ${hidden}`)
}
fs.rmSync(path.join(root, "packages/a/src/a.spec.js"))
execFileSync("git", ["add", "-A"], { cwd: root })

write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
const fixed = (await readSticks(root)).drift
if (fixed.length !== 1 || !fixed[0].startsWith("known faults is 0")) {
  throw new Error(`a fixed fault must be recorded\n${fixed.join("\n")}`)
}

write("packages/a/src/a.spec.js", "expect(result.failed).toBe(1)\nexpect.soft(failure).toBeDefined()\n")
execFileSync("git", ["add", "-A"], { cwd: root })
if ((await readSticks(root)).rows.find((row) => row.name === "known faults")?.now !== 0)
  throw new Error("a passing test was counted as a known fault")

write(
  "sticks.json",
  JSON.stringify({
    "known faults": { now: 0, goal: 0 },
    "routes pptx writes": { now: 1, goal: 4 },
    "nobody measures": { now: 1, goal: 0 },
    "nobody times": { limit: 5 },
  }),
)
const loose = (await readSticks(root)).drift.join("\n")
if (!loose.includes("routes pptx writes is 2 and sticks.json says 1. Record 2 in sticks.json.")) throw new Error(loose)
if (!loose.includes("routes pptx writes has goal 3 and sticks.json says 4. Record goal 3 in sticks.json."))
  throw new Error(loose)
if (!loose.includes("nobody times has a limit in sticks.json and no runner times it.")) throw new Error(loose)
if (!loose.includes("check seconds is timed by scripts/check.mjs and has no limit in sticks.json."))
  throw new Error(loose)
if (!loose.includes("nobody measures is in sticks.json and nothing measures it.")) throw new Error(loose)
if (!loose.includes("real decks in the PowerPoint check is measured and missing from sticks.json."))
  throw new Error(loose)

console.log("sticks tests passed")
