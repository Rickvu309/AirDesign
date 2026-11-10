import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { passedWrites } from "./pptx-route-judge.mjs"
import { overLimit, readSticks, timeStick } from "./sticks.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-sticks-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))

const write = (relative, source) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
}
const cache = (tests, faults) => {
  const file = path.join(root, "node_modules/.cache/vitest-sticks.json")
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ tests, faults })}\n`)
}
const record = (faults, tests = 2) => {
  cache(tests, faults)
  write(
    "sticks.json",
    JSON.stringify({
      "known faults": { now: faults, goal: 0 },
      tests: { floor: tests },
      "real decks in the PowerPoint check": { now: 1, goal: 20 },
      "routes pptx writes": { now: 2, goal: 3 },
      "planted breaks the judge catches": { now: 1, goal: 2 },
      "check seconds": { limit: 40 },
      "PowerPoint check seconds": { limit: 90 },
    }),
  )
}

write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
write(
  "scripts/pptx-fixtures/cases.json",
  JSON.stringify([
    { before: "a.pptx", after: "b.pptx" },
    { before: "a.pptx", after: "a.pptx" },
  ]),
)
write("scripts/pptx-fixtures/judge-proof.json", JSON.stringify({ "one kind": "caught", "other kind": "missed" }))
write("scripts/pptx-fixtures/a.pptx", "x".repeat(100_000))
write("scripts/pptx-fixtures/b.pptx", "y".repeat(100_000))
write("scripts/pptx-fixtures/routes.pptx", "deck")
write(
  "packages/document/dist/index.js",
  `export const properties = { shape: { box: { route: "xfrm" }, text: { route: "txBody" } }, kept: { box: { route: "xfrm" } } }
export const structure = { deck: {}, shape: { create: { route: "spTree.add" } } }
`,
)
write(
  "packages/pptx/dist/index.js",
  `export const writtenRoutes = { text: "txBody", move: "xfrm", resize: "xfrm", add: "spTree.add" }
export const routeOperations = ["text", "move", "resize"]
const passed = (operation, route) => ({ operation, route, error: null, touch: { changed: ["s"], added: [], removed: [] }, parts: new Map() })
export function routeRuns() {
  return [passed("text", "txBody"), passed("move", "xfrm"), passed("resize", "xfrm")]
}
export async function readParts() { return new Map([["s", new Uint8Array([1])]]) }
export async function exportPackage() { return new Uint8Array([2]) }
export function newValidatorErrors() { return [] }
export function shapeIdCounts() { return [] }
export function newDuplicateShapeIds() { return [] }
export function touchMatches() { return true }
`,
)
record(1)
execFileSync("git", ["init", "-q"], { cwd: root })
execFileSync("git", ["add", "-A"], { cwd: root })

const steady = await readSticks(root)
if (steady.drift.length !== 0) throw new Error(`a matching record drifted\n${steady.drift.join("\n")}`)
if (steady.rows.find((row) => row.name === "known faults")?.now !== 1)
  throw new Error("one known fault was not counted")

cache(2, 2)
if (steady.rows.find((row) => row.name === "check seconds")?.limit !== 40)
  throw new Error("a limit stick was not listed")

const capabilities = steady.rows.find((row) => row.name === "routes pptx writes")
if (capabilities?.now !== 2 || capabilities.goal !== 3)
  throw new Error(`routes that passed were not counted: ${JSON.stringify(capabilities)}`)
if (steady.rows.find((row) => row.name === "real decks in the PowerPoint check")?.now !== 1)
  throw new Error("a copied deck was counted, or the judged deck was not")
const oneFailure = passedWrites([
  {
    runs: [
      { route: "txBody", passed: true },
      { route: "xfrm", passed: false },
    ],
  },
])
if (oneFailure.routes !== 1 || oneFailure.decks !== 0)
  throw new Error(`a failed route still counted: ${JSON.stringify(oneFailure)}`)
const twoDecks = passedWrites([
  { runs: [{ route: "txBody", passed: true }] },
  {
    runs: [
      { route: "txBody", passed: true },
      { route: "xfrm", passed: true },
    ],
  },
])
if (twoDecks.routes !== 2 || twoDecks.decks !== 2)
  throw new Error(`two passing decks were not counted: ${JSON.stringify(twoDecks)}`)
const unfinished = passedWrites([{ runs: [{ route: "txBody", passed: true }], missing: true }])
if (unfinished.routes !== 1 || unfinished.decks !== 0)
  throw new Error(`a deck with a missing route counted: ${JSON.stringify(unfinished)}`)

const planted = steady.rows.find((row) => row.name === "planted breaks the judge catches")
if (planted?.now !== 1 || planted.goal !== 2)
  throw new Error(`caught kinds were not counted: ${JSON.stringify(planted)}`)

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

cache(2, 0)
write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
const fixed = (await readSticks(root)).drift
if (fixed.length !== 1 || !fixed[0].startsWith("known faults is 0")) {
  throw new Error(`a fixed fault must be recorded\n${fixed.join("\n")}`)
}

write("packages/a/src/a.spec.js", "expect(result.failed).toBe(1)\nexpect.soft(failure).toBeDefined()\n")
execFileSync("git", ["add", "-A"], { cwd: root })
if ((await readSticks(root)).rows.find((row) => row.name === "known faults")?.now !== 0)
  throw new Error("a passing test was counted as a known fault")
cache(1, 0)
const fewer = (await readSticks(root)).drift
if (!fewer.includes("tests is 1 and sticks.json says 2. Record 1 in sticks.json.")) {
  throw new Error(`a deleted test must lower the count\n${fewer.join("\n")}`)
}
cache(2, 0)

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

const proveVitest = () => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-vitest-sticks-"))
  const reported = path.join(probe, "result.json")
  try {
    fs.writeFileSync(
      path.join(probe, "sample.test.ts"),
      [
        'import fc from "fast-check"',
        'import { describe, expect, it, test } from "vitest"',
        'it("plain", () => { expect(1).toBe(1) })',
        'it("property", () => { fc.assert(fc.property(fc.integer(), (value) => value === value)) })',
        'it("none", () => {})',
        'it("early", () => { return })',
        'it.skip("skipped", () => {})',
        'it.skipIf(true)("skip if", () => {})',
        'it.runIf(false)("run if", () => {})',
        'it.fails("expected", () => { expect(1).toBe(2) })',
        'it("option", { fails: true }, () => { expect(1).toBe(2) })',
        'test.todo("todo")',
        'it["skip"]("bracket", () => {})',
        'describe.skip("block", () => { it("inside", () => {}) })',
        'it("reads skip", () => { expect({ skip: true }.skip).toBe(true) })',
        'it("ctx", (ctx) => { ctx.skip() })',
        "",
      ].join("\n"),
    )
    fs.writeFileSync(
      path.join(probe, "vitest.config.mts"),
      [
        'import { defineConfig } from "vitest/config"',
        "export default defineConfig({",
        "  resolve: {",
        "    alias: [{",
        "      find: /^fast-check$/,",
        `      replacement: ${JSON.stringify(path.join(repoRoot, "scripts/property-count.mjs"))},`,
        "    }],",
        "  },",
        "  test: {",
        '    include: ["sample.test.ts"],',
        `    setupFiles: [${JSON.stringify(path.join(repoRoot, "scripts/vitest-assertions.mjs"))}],`,
        `    reporters: ["default", ${JSON.stringify(path.join(repoRoot, "scripts/vitest-sticks.mjs"))}],`,
        "  },",
        "})",
        "",
      ].join("\n"),
    )
    fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(probe, "node_modules"), "dir")
    try {
      execFileSync(process.execPath, [path.join(repoRoot, "node_modules/vitest/vitest.mjs"), "run"], {
        cwd: probe,
        env: { ...process.env, AIRDESIGN_VITEST_STICKS: reported },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      const failed = error
      throw new Error(`${failed.stdout ?? ""}\n${failed.stderr ?? failed.message}`)
    }
    const counted = JSON.parse(fs.readFileSync(reported, "utf8"))
    if (counted.tests !== 14 || counted.faults !== 11) {
      throw new Error(`vitest counted ${JSON.stringify(counted)}, expected 14 tests and 11 faults`)
    }
  } finally {
    fs.rmSync(path.join(probe, "node_modules"), { force: true })
    fs.rmSync(probe, { recursive: true, force: true })
  }
}

proveVitest()

console.log("sticks tests passed")
