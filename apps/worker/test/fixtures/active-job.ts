import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"

const directory = process.env.AIRDESIGN_JOB_DIRECTORY ?? process.cwd()
const descendant = spawn("sleep", ["300"], { detached: true, stdio: "ignore" })
writeFileSync(path.join(directory, "descendant"), String(descendant.pid))
let completed = 0
setInterval(() => {
  const child = spawn("sleep", ["0.01"], { detached: true, stdio: "ignore" })
  child.once("exit", (code, signal) => {
    assert.equal(signal, null)
    assert.equal(code, 0)
    completed++
    if (completed === 30) writeFileSync(path.join(directory, "healthy"), String(process.pid))
  })
}, 15)
