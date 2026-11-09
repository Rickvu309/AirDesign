import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertJar, checkSpec, jarPath, javaBin } from "./check-specs.mjs"

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
fs.cpSync(path.join(root, "specs/edit"), directory, { recursive: true })
fs.writeFileSync(path.join(directory, "Edit.tla"), source.replace(guard, opened))

const java = javaBin()
const jar = jarPath()
assertJar(jar)
const result = checkSpec(directory, java, jar)
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

console.log("check-specs tests passed")
