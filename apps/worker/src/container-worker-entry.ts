import os from "node:os"
import { spawn } from "node:child_process"
import { cleanContainerJob, processIdentity } from "./container-job-processes.ts"
import { containerOuterRoot } from "./container-worker-ownership.ts"

const entry = process.argv[2]
if (!entry) throw new Error("missing-container-worker-entry")
const outer = containerOuterRoot(process.ppid)
const guardian = processIdentity(process.pid)
if (!guardian) throw new Error("missing-container-worker-guardian")
cleanContainerJob(outer, false)
const child = spawn(process.execPath, [entry, ...process.argv.slice(3)], {
  stdio: "inherit", env: { ...process.env, AIRDESIGN_OUTER_GUARDIAN: `${guardian.pid}:${guardian.identity}` },
})
const clean = () => cleanContainerJob(outer, false)
process.once("exit", clean)
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { child.kill(signal) })
child.once("error", () => { clean(); process.exitCode = 1 })
child.once("exit", (code, signal) => {
  clean()
  process.exitCode = code ?? (signal ? 128 + os.constants.signals[signal] : 1)
})
