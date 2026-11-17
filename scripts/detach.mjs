import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const detachFolder = path.join(os.homedir(), ".cache", "airdesign", "detached")
export const waitLimitMs = 8 * 60 * 1000
export const stillRunning = 75

const self = fileURLToPath(import.meta.url)
const runFolder = (folder, root) =>
  path.join(folder, createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 16))

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === "EPERM"
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return undefined
  }
}

const exitCode = (where) => {
  try {
    return Number(fs.readFileSync(path.join(where, "status"), "utf8"))
  } catch {
    return undefined
  }
}

export const startDetached = ({ folder = detachFolder, root, command, say }) => {
  const where = runFolder(folder, root)
  const held = readJson(path.join(where, "run.json"))
  if (held !== undefined && exitCode(where) === undefined && alive(held.pid)) {
    say(`a detached run of ${held.command.join(" ")} is still going here. Follow it: pnpm detach --wait`)
    return 1
  }
  fs.rmSync(where, { recursive: true, force: true })
  fs.mkdirSync(where, { recursive: true })
  const log = path.join(where, "output.log")
  const runner = spawn(process.execPath, [self, "--run", where, ...command], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  })
  runner.unref()
  fs.writeFileSync(
    path.join(where, "run.json"),
    JSON.stringify({ pid: runner.pid, command, root: path.resolve(root), log, started: new Date().toISOString() }),
  )
  say(`started ${command.join(" ")} in its own session; its output goes to ${log}`)
  say("Follow it with pnpm detach --wait, again after each 8 minutes. Ending this call does not stop it.")
  return 0
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitDetached = async ({ folder = detachFolder, root, limitMs = waitLimitMs, say, write = say }) => {
  const where = runFolder(folder, root)
  const held = readJson(path.join(where, "run.json"))
  if (held === undefined) {
    say("no detached run in this worktree. Start one: pnpm detach <script> [args]")
    return 1
  }
  const seenFile = path.join(where, "seen")
  let seen = Number(readJson(seenFile) ?? 0)
  const drain = (finished) => {
    let pending
    try {
      pending = fs.readFileSync(held.log).subarray(seen)
    } catch {
      return
    }
    const end = finished ? pending.length : pending.lastIndexOf(10) + 1
    if (end === 0) return
    const text = pending.subarray(0, end).toString("utf8")
    seen += end
    fs.writeFileSync(seenFile, JSON.stringify(seen))
    const lines = text.split("\n")
    if (lines.at(-1) === "") lines.pop()
    for (const line of lines) write(line)
  }
  const until = Date.now() + limitMs
  for (;;) {
    const code = exitCode(where)
    drain(code !== undefined)
    if (code !== undefined) {
      say(`detached run of ${held.command.join(" ")} ended: exit ${String(code)}`)
      return code
    }
    if (!alive(held.pid)) {
      say(`the detached run of ${held.command.join(" ")} died with no exit code. Its log: ${held.log}`)
      return 1
    }
    if (Date.now() >= until) {
      say(`still running: ${held.command.join(" ")}. Run pnpm detach --wait again.`)
      return stillRunning
    }
    await pause(Math.min(1000, Math.max(10, until - Date.now())))
  }
}

const runAndRecord = (where, [command, ...args]) => {
  const log = fs.openSync(path.join(where, "output.log"), "a")
  const child = spawn(command, args, { stdio: ["ignore", log, log] })
  const finish = (code) => fs.writeFileSync(path.join(where, "status"), String(code))
  child.on("error", (error) => {
    fs.writeSync(log, `${error.message}\n`)
    finish(127)
  })
  child.on("close", (code, signal) => finish(code ?? (signal === null ? 1 : 128)))
}

export const usage = "usage: pnpm detach <script> [args]   or   pnpm detach --wait"

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [first, ...rest] = process.argv.slice(2)
  const root = path.resolve(path.dirname(self), "..")
  const say = (line) => console.log(line)
  if (first === "--run") runAndRecord(rest[0], rest.slice(1))
  else if (first === "--wait" && rest.length === 0) process.exit(await waitDetached({ root, say }))
  else if (first === undefined || first.startsWith("-")) {
    console.error(usage)
    process.exit(1)
  } else process.exit(startDetached({ root, command: ["pnpm", first, ...rest], say }))
}
