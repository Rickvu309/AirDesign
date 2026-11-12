import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertJar, checkSpec, chosenTopics, jarPath, javaBin, readableTrace, topics } from "./check-specs.mjs"
import * as editView from "../specs/edit/view.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "specs/edit/Edit.tla"), "utf8")
const guard = [
  "AgentWrites ==",
  '  /\\ phase = "running"',
  "  /\\ guarded = FALSE",
  "  /\\ agent = 0",
  "  /\\ readAt = Version",
].join("\n")
const opened = ["AgentWrites ==", '  /\\ phase = "running"', "  /\\ agent = 0"].join("\n")
if (!source.includes(guard)) throw new Error("the agent write guard was not found")

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-edit-"))
process.on("exit", () => fs.rmSync(directory, { recursive: true, force: true }))
fs.cpSync(path.join(root, "specs/edit"), directory, { recursive: true })
fs.writeFileSync(path.join(directory, "Edit.tla"), source.replace(guard, opened))
fs.writeFileSync(path.join(directory, "Stamp.tla"), `---- MODULE Stamp ----\nStamp == ${Date.now()}\n====\n`)

const java = javaBin()
const jar = jarPath()
assertJar(jar)
const realRemove = fs.rmSync
let integersInModuleDir = false
fs.rmSync = (target, options) => {
  const location = String(target)
  if (path.basename(location).startsWith("airdesign-tlc-modules-")) {
    integersInModuleDir = fs.existsSync(path.join(location, "Integers.tla"))
  }
  return realRemove(target, options)
}
let result
try {
  result = checkSpec(directory, java, jar)
} finally {
  fs.rmSync = realRemove
}
if (!integersInModuleDir) throw new Error("Integers.tla was not in the private module directory")
const trace = result.output
const read = trace.indexOf("<RunStarts")
const edited = trace.indexOf("<PersonWrites")
const wrote = trace.indexOf("<AgentWrites")
if (result.passed || !trace.includes("Invariant AgentSawCurrent is violated.")) {
  throw new Error(`the stale write was accepted\n${trace}`)
}
if (!(read >= 0 && edited > read && wrote > edited)) {
  throw new Error(`the stale-write path was not shown\n${trace}`)
}
if (!trace.includes("guarded = TRUE") || !trace.includes("agent = 1")) {
  throw new Error(`the agent wrote on a guarded property\n${trace}`)
}

const told = readableTrace(trace, editView)
if (
  !told.startsWith("Invariant AgentSawCurrent is violated.") ||
  !told.includes("the person edits [during the run] [PersonWrites]: Person edit, person is guarding") ||
  !told.includes("guarded false -> true")
) {
  throw new Error(`the counterexample was not told step by step\n${told}`)
}
const every = topics(root)
if (
  chosenTopics(every, ["edit"])
    .map((topic) => topic.name)
    .join() !== "edit"
)
  throw new Error("edit alone was not chosen")
if (chosenTopics(every, []).length !== every.length) throw new Error("no name did not choose every spec")
let unknown = ""
try {
  chosenTopics(every, ["nothing"])
} catch (error) {
  unknown = error.message
}
if (unknown !== "no spec named nothing") throw new Error(`an unknown spec name was not refused: ${unknown}`)

console.log("check-specs tests passed")
