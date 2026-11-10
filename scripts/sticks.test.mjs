import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { readSticks } from "./sticks.mjs"

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
record(1)
execFileSync("git", ["init", "-q"], { cwd: root })
execFileSync("git", ["add", "-A"], { cwd: root })

const steady = readSticks(root)
if (steady.drift.length !== 0) throw new Error(`a matching record drifted\n${steady.drift.join("\n")}`)
if (steady.rows.find((row) => row.name === "known faults")?.now !== 1)
  throw new Error("one known fault was not counted")

write("packages/a/src/a.test.ts", `${faultCall}"one", () => {})\n${faultCall}"two", () => {})\n`)
const added = readSticks(root).drift
if (added.length !== 1 || added[0] !== "known faults is 2 and sticks.json says 1. Record 2 in sticks.json.") {
  throw new Error(`a new known fault must be recorded\n${added.join("\n")}`)
}

for (const hidden of [
  'it.skip("one", () => {})',
  'it.todo("one")',
  'it("one", { fails: true }, () => {})',
  'it.fails.each([1])("one", () => {})',
]) {
  write("packages/a/src/a.spec.js", `${hidden}\n`)
  execFileSync("git", ["add", "-A"], { cwd: root })
  const seen = readSticks(root).rows.find((row) => row.name === "known faults")?.now
  if (seen !== 3) throw new Error(`a hidden fault was not counted: ${hidden}`)
}
fs.rmSync(path.join(root, "packages/a/src/a.spec.js"))
execFileSync("git", ["add", "-A"], { cwd: root })

write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
const fixed = readSticks(root).drift
if (fixed.length !== 1 || !fixed[0].startsWith("known faults is 0")) {
  throw new Error(`a fixed fault must be recorded\n${fixed.join("\n")}`)
}

write("sticks.json", JSON.stringify({ "known faults": { now: 0, goal: 0 }, "nobody measures": { now: 1, goal: 0 } }))
const loose = readSticks(root).drift.join("\n")
if (!loose.includes("nobody measures is in sticks.json and nothing measures it.")) throw new Error(loose)
if (!loose.includes("real decks in the PowerPoint check is measured and missing from sticks.json."))
  throw new Error(loose)

console.log("sticks tests passed")
