import { spawn } from "node:child_process"
import path from "node:path"
import { cleanContainerJob } from "./container-job-processes.ts"

const [program, worker, limits] = process.argv.slice(2)
const directory = process.env.AIRDESIGN_JOB_DIRECTORY
if (!program || !worker || !limits || !directory) throw new Error("missing-container-job")
const supervisor = process.pid
const clean = () => cleanContainerJob(directory)
const stop = () => { clean(); process.exit(137) }
process.once("SIGTERM", stop)
process.once("SIGINT", stop)
process.once("exit", clean)
const guard = setInterval(() => { if (process.ppid !== Number(worker)) stop() }, 100)
let command = ""
for await (const chunk of process.stdin) command += chunk.toString()
if (command !== "start" || process.ppid !== Number(worker)) stop()
const child = spawn("prlimit", [...JSON.parse(limits), "--fsize=524288000", "--nofile=256", "--", process.execPath, "--max-old-space-size=256", program.endsWith("/export/entry.ts") ? "--disable-proto=delete" : "--disable-proto=throw", "--import", path.join(import.meta.dirname, "container-network.ts"), path.join(import.meta.dirname, "container-entry.ts"), program, String(supervisor)], { detached: true, stdio: ["pipe", "ignore", "inherit"], env: { ...process.env, TMPDIR: `/proc/${supervisor}/cwd` } })
child.stdin.end("start")
child.once("error", () => { clean(); process.exit(1) })
child.once("exit", (code, signal) => {
  clearInterval(guard)
  clean()
  if (signal) {
    process.removeAllListeners(signal)
    process.kill(process.pid, signal)
  } else process.exit(code ?? 1)
})
