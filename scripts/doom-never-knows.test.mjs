import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkSteps } from "./check-steps.mjs"
import { ceilingFaults, countsByFile, doomOffences, offences, readCeiling } from "./doom-never-knows.mjs"

const hex = (digits) => `#${digits}`
const ink = hex("0b1b2b")
const red = hex("ff0000")
const blue = hex("0000ff")
const kinds = (file, source) => offences(file, source).map((each) => `${each.kind}: ${each.what}`)

assert.deepEqual(kinds("agent-place.ts", "export const gapShare = 0.015"), [
  "host: file agent-place.ts",
  "taste: gapShare, a share of the slide",
])
assert.deepEqual(kinds("layout-problems.ts", "export type Problem = { readonly note: string }"), [
  "host: a note for a reader",
])
assert.deepEqual(kinds("read-kit.ts", 'export const forms = { node: "A node id, or null." }'), [
  "words: A node id, or null.",
])
assert.deepEqual(kinds("theme.ts", `const ink = "${ink}"`), [`taste: colour ${ink}`])
assert.deepEqual(kinds("placeholder-title.ts", 'export const placeholderTitle = "Untitled"'), ['taste: "Untitled"'])
assert.deepEqual(kinds("index.ts", 'export { readForAgent } from "./read.js"'), ["host: export readForAgent"])
assert.deepEqual(kinds("layout-problems.ts", 'const judged = text.style !== "title" && "heading" === text.style'), [
  'taste: a rule for "title" text',
  'taste: a rule for "heading" text',
])
assert.deepEqual(kinds("apply-edit.ts", 'if (author.kind === "agent") refuse("run-fenced")'), [])
assert.deepEqual(kinds("order-key.ts", 'throw new Error("invalid order key head")'), [])
assert.deepEqual(kinds("preset-basic.ts", 'const guide = "dx1 cos swd2 1080000 val adj"'), [])
assert.deepEqual(kinds("painted-face.ts", 'const names = ["Thin", "Regular", "Bold"]'), [])
assert.deepEqual(kinds("layered-map.ts", 'const tag = "Map"'), [])
assert.deepEqual(kinds("solve-layout.ts", "const [mainShare, crossShare] = alignOf(align)"), [])

assert.deepEqual(readCeiling('{"theme.ts": 2}'), { "theme.ts": 2 })
assert.deepEqual(readCeiling("{}"), {})
assert.throws(() => readCeiling("[]"), /object/)
assert.throws(() => readCeiling('{"theme.ts": 0}'), /positive integer/)
assert.throws(() => readCeiling('{"theme.ts": -1}'), /positive integer/)
assert.throws(() => readCeiling('{"theme.ts": 1.5}'), /positive integer/)

const planted = offences("theme.ts", `const red = "${red}"`)
assert.deepEqual(countsByFile(planted), { "theme.ts": 1 })
assert.deepEqual(ceilingFaults({ found: planted, ceiling: { "theme.ts": 1 }, base: undefined }), {
  faults: [],
  exceeded: [],
})

const overClean = ceilingFaults({ found: planted, ceiling: {}, base: {} })
assert.deepEqual(overClean.exceeded, ["theme.ts"])
assert.match(overClean.faults[0], /above ceiling 0/)

const overExisting = ceilingFaults({
  found: [...planted, ...offences("theme.ts", `const blue = "${blue}"`)],
  ceiling: { "theme.ts": 1 },
  base: { "theme.ts": 1 },
})
assert.deepEqual(overExisting.exceeded, ["theme.ts"])
assert.match(overExisting.faults[0], /2 offences, above ceiling 1/)

const belowExisting = ceilingFaults({ found: planted, ceiling: { "theme.ts": 2 }, base: { "theme.ts": 2 } })
assert.deepEqual(belowExisting.exceeded, [])
assert.match(belowExisting.faults[0], /below ceiling 2/)

const clearedFile = ceilingFaults({ found: [], ceiling: { "theme.ts": 1 }, base: { "theme.ts": 1 } })
assert.deepEqual(clearedFile.exceeded, [])
assert.match(clearedFile.faults[0], /Remove it from scripts\/doom-never-knows\.json/)

const raisedCeiling = ceilingFaults({ found: planted, ceiling: { "theme.ts": 1 }, base: {} })
assert.match(raisedCeiling.faults[0], /above origin\/main \(0\)/)

assert.deepEqual(ceilingFaults({ found: planted, ceiling: { "theme.ts": 1 }, base: { "theme.ts": 2 } }), {
  faults: [],
  exceeded: [],
})

assert.equal(checkSteps.warns("doom-never-knows", ""), true)
assert.equal(checkSteps.showsOutput("doom-never-knows"), true)

const scriptPath = fileURLToPath(new URL("./doom-never-knows.mjs", import.meta.url))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "doom-never-knows-"))
try {
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  const origin = path.join(temp, "origin")
  const clone = path.join(temp, "clone")
  fs.mkdirSync(path.join(origin, "packages/doom/src/testing"), { recursive: true })
  fs.mkdirSync(path.join(origin, "scripts"), { recursive: true })
  git(origin, "init", "-q", "-b", "main")
  git(origin, "config", "user.email", "t@example.com")
  git(origin, "config", "user.name", "t")
  fs.writeFileSync(path.join(origin, "packages/doom/src/theme.ts"), `export const ink = "${ink}"\n`)
  fs.writeFileSync(path.join(origin, "packages/doom/src/theme.test.ts"), `export const red = "${red}"\n`)
  fs.writeFileSync(path.join(origin, "packages/doom/src/sample-deck.ts"), `export const red = "${red}"\n`)
  fs.writeFileSync(path.join(origin, "packages/doom/src/testing/board-deck.ts"), `export const red = "${red}"\n`)
  fs.writeFileSync(path.join(origin, "scripts/doom-never-knows.json"), '{\n  "theme.ts": 1\n}\n')
  git(origin, "add", "-A")
  git(origin, "commit", "-q", "-m", "initial ceiling")
  git(temp, "clone", "-q", origin, clone)

  assert.deepEqual(countsByFile(doomOffences(clone)), { "theme.ts": 1 })

  const runCli = () => spawnSync(process.execPath, [scriptPath, clone], { encoding: "utf8" })
  const clean = runCli()
  assert.equal(clean.status, 0, clean.stderr)
  assert.match(clean.stdout, /1 \(1 taste\) in 1 file/)

  fs.writeFileSync(path.join(clone, "packages/doom/src/clean.ts"), `export const red = "${red}"\n`)
  const withPlanted = runCli()
  assert.equal(withPlanted.status, 1)
  assert.ok(withPlanted.stderr.includes(red))
  assert.match(withPlanted.stderr, /above ceiling 0/)

  fs.writeFileSync(path.join(clone, "scripts/doom-never-knows.json"), '{\n  "clean.ts": 1,\n  "theme.ts": 1\n}\n')
  const raised = runCli()
  assert.equal(raised.status, 1)
  assert.match(raised.stderr, /above origin\/main \(0\)/)

  fs.rmSync(path.join(clone, "packages/doom/src/clean.ts"))
  fs.writeFileSync(path.join(clone, "packages/doom/src/theme.ts"), "export const ok = 1\n")
  fs.writeFileSync(path.join(clone, "scripts/doom-never-knows.json"), "{}\n")
  const shrunk = runCli()
  assert.equal(shrunk.status, 0, shrunk.stderr)
  assert.match(shrunk.stdout, /Doom knows no host, words or taste/)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
