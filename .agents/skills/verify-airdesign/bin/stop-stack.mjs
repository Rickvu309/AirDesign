import { appendFileSync, copyFileSync, existsSync, readFileSync, readlinkSync, realpathSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { setTimeout as pause } from "node:timers/promises"
import { alive, canonical, ownsServe, runPostgres } from "./leftover-runs.mjs"

function pidFileFor(state, scratch) {
  const dataDir = state.postgres?.dataDir
  if (typeof dataDir !== "string") return undefined
  if (state.postgres.pidFile !== undefined) {
    const expected = runPostgres(scratch)
    return dataDir === expected.dataDir && state.postgres.pidFile === expected.pidFile ? expected.pidFile : undefined
  }
  const clusterDir = path.dirname(dataDir)
  if (path.dirname(clusterDir) !== canonical(path.join(os.homedir(), "tmp"))) return undefined
  if (!path.basename(clusterDir).startsWith("airdesign-api-") || path.basename(dataDir) !== "data") return undefined
  return path.join(dataDir, "postmaster.pid")
}

function postmasterMatches(pid, dataDir) {
  try {
    if (path.basename(readlinkSync(`/proc/${pid}/exe`)) !== "postgres") return false
    const args = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")
    const flag = args.lastIndexOf("-D")
    return flag >= 0 && args[flag + 1] === dataDir
  } catch {
    return false
  }
}

function pidRecord(pidFile) {
  try {
    const [pidText, directory] = readFileSync(pidFile, "utf8").split("\n")
    return { pid: Number(pidText), directory }
  } catch (error) {
    if (error.code === "ENOENT") return {}
    throw error
  }
}

export function postgresPid(state, scratch) {
  const pidFile = pidFileFor(state, scratch)
  if (pidFile === undefined || realpathOrMissing(pidFile) !== pidFile) return undefined
  const dataDir = path.dirname(pidFile)
  const { pid, directory } = pidRecord(pidFile)
  if (directory !== dataDir || !alive(pid)) return undefined
  if (state.postgres.pidFile === undefined && state.postgres.pid !== pid) return undefined
  return postmasterMatches(pid, dataDir) ? pid : undefined
}

function realpathOrMissing(dir) {
  try {
    return realpathSync(dir)
  } catch {
    return undefined
  }
}

export async function stopStack({ run, scratch, evidence }) {
  const stateFile = path.join(scratch, "state.json")
  if (!existsSync(stateFile)) return { run, stopped: [], note: "no state; nothing of this run is running" }
  const state = JSON.parse(readFileSync(stateFile, "utf8"))
  if (state.run !== run) throw new Error(`unexpected state for run ${run}`)
  const stopped = []
  const preserve = (reason) => ({ run, stopped, left: [`${reason}. Run files kept at ${scratch}`] })
  const runDir = path.join(canonical(path.dirname(scratch)), path.basename(scratch))
  if (realpathOrMissing(scratch) !== runDir) return preserve("could not verify the run directory")
  if (ownsServe(state)) {
    process.kill(state.pid, "SIGTERM")
    for (let waited = 0; waited < 15_000 && ownsServe(state); waited += 250) await pause(250)
    if (ownsServe(state)) {
      process.kill(state.pid, "SIGKILL")
      while (ownsServe(state)) await pause(250)
    }
    stopped.push(`serve ${String(state.pid)}`)
  }
  const postgres = postgresPid(state, scratch)
  if (postgres === undefined) {
    const expected = runPostgres(scratch).pidFile
    const recorded = pidFileFor(state, scratch)
    const pidFiles = new Set([expected, recorded].filter((file) => file !== undefined))
    for (const pidFile of pidFiles) {
      if (alive(pidRecord(pidFile).pid)) return preserve("could not verify the postmaster")
    }
  } else {
    try {
      process.kill(postgres, "SIGINT")
    } catch (error) {
      if (error.code !== "ESRCH") throw error
    }
    const running = () => postmasterMatches(postgres, state.postgres.dataDir)
    for (let waited = 0; waited < 15_000 && running(); waited += 250) await pause(250)
    if (running()) throw new Error(`Postgres for run ${run} did not stop`)
    stopped.push(`postgres ${String(postgres)}`)
    if (state.postgres.pidFile === undefined)
      rmSync(path.dirname(state.postgres.dataDir), { recursive: true, force: true })
  }
  const stackLog = path.join(scratch, "stack.log")
  if (existsSync(stackLog) && existsSync(evidence)) copyFileSync(stackLog, path.join(evidence, "stack.log"))
  rmSync(scratch, { recursive: true, force: true })
  if (existsSync(evidence))
    appendFileSync(path.join(evidence, "proof.md"), `- stopped: ${stopped.join(", ") || "nothing was running"}\n`)
  return { run, stopped, left: [], evidence, evidenceKept: existsSync(evidence) }
}
