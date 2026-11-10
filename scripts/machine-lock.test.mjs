import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { takeMachineLock } from "./machine-lock.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "machine-lock-"))
const file = path.join(folder, "nested", "machine.lock")
const module = fileURLToPath(new URL("./machine-lock.mjs", import.meta.url))

const said = []
const first = {}
const release = await takeMachineLock({ file, env: first, say: (line) => said.push(line) })
if (first.AIRDESIGN_MACHINE_LOCK !== file) fail("the holder does not mark its own environment")
if (said.length !== 0) fail("a free lock said it was waiting")

const inside = await takeMachineLock({ file, env: first, say: (line) => said.push(line) })
inside()
if (said.length !== 0) fail("a check inside a check waited for its own lock")

const onCi = await takeMachineLock({ file, env: { CI: "true" }, say: (line) => said.push(line) })
onCi()
if (said.length !== 0) fail("CI waited for the machine lock")

const second = spawn(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `import { takeMachineLock } from ${JSON.stringify(module)}
     const release = await takeMachineLock({ file: ${JSON.stringify(file)}, env: {} })
     console.log("started")
     release()`,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
)
let out = ""
let err = ""
second.stdout.on("data", (chunk) => (out += chunk))
second.stderr.on("data", (chunk) => (err += chunk))
await new Promise((resolve) => second.stderr.once("data", resolve))
if (out.includes("started")) fail("a second check started while the first held the lock")
if (!err.includes("Another check is running on this machine.")) fail("a waiting check did not say why it waits")

release()
const status = await new Promise((resolve) => second.on("close", resolve))
if (status !== 0 || !out.includes("started")) fail("the second check did not start after the first ended")

const third = await takeMachineLock({ file, env: {}, say: (line) => said.push(line) })
third()
if (said.length !== 0) fail("the lock was still held after both checks ended")

const fourth = await takeMachineLock({ file, env: {}, say: () => {} })
await fourth()
const fifth = await takeMachineLock({ file, env: {}, say: (line) => said.push(line) })
fifth()
if (said.length !== 0) fail("the lock was held after its release finished")

fs.rmSync(folder, { recursive: true, force: true })
console.log("machine lock tests passed")
