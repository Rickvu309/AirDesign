import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertJar, checkSpec, chosenTopics, jarPath, javaBin, readableTrace, topics } from "./check-specs.mjs"
import * as runsView from "../specs/doom-runs/view.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = fs.readFileSync(path.join(root, "specs/doom-runs/DoomRuns.tla"), "utf8")
const guard = "  /\\ Protect(TRUE, FALSE)\n"
const opened = "  /\\ Protect(TRUE, TRUE)\n"
if (!source.includes(guard)) throw new Error("the person's protection of the text was not found")

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-doom-runs-"))
process.on("exit", () => fs.rmSync(directory, { recursive: true, force: true }))
fs.cpSync(path.join(root, "specs/doom-runs"), directory, { recursive: true })
fs.writeFileSync(path.join(directory, "DoomRuns.tla"), source.replace(guard, opened))
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
  result = checkSpec(directory, java, jar, "DoomRuns.tla", "DoomRuns.cfg")
} finally {
  fs.rmSync = realRemove
}
if (!integersInModuleDir) throw new Error("Integers.tla was not in the private module directory")
const trace = result.output
const started = trace.indexOf("<StartA")
const wrote = trace.indexOf("<PersonWrites")
if (result.passed || !trace.includes("Invariant ProtectedOnlyByThePerson is violated.")) {
  throw new Error(`a protection of a node the person never wrote was accepted\n${trace}`)
}
if (!(started >= 0 && wrote > started)) throw new Error(`the path to the wrong protection was not shown\n${trace}`)
if (!trace.includes("gaN = TRUE")) throw new Error(`the notes were not shown protected\n${trace}`)

const told = readableTrace(trace, runsView)
if (
  !told.startsWith("Invariant ProtectedOnlyByThePerson is violated.") ||
  !told.includes("the person writes the text [PersonWrites]") ||
  !told.includes("gaN false -> true")
) {
  throw new Error(`the counterexample was not told step by step\n${told}`)
}
const every = topics(root)
if (
  chosenTopics(every, ["doom-runs"])
    .map((topic) => topic.name)
    .join() !== "doom-runs"
)
  throw new Error("doom-runs alone was not chosen")
if (chosenTopics(every, []).length !== every.length) throw new Error("no name did not choose every spec")
let unknown = ""
try {
  chosenTopics(every, ["nothing"])
} catch (error) {
  unknown = error.message
}
if (unknown !== "no spec named nothing") throw new Error(`an unknown spec name was not refused: ${unknown}`)

console.log("check-specs tests passed")
