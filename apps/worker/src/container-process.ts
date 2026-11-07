import {exportLimits} from "../../../packages/operations/src/export-failure.ts"
import {spawn, type ChildProcess} from "node:child_process"
import path from "node:path"
import os from "node:os"
import { cleanContainerJob, processIdentity, type ProcessIdentity } from "./container-job-processes.ts"

const roots = new WeakMap<ChildProcess, ProcessIdentity>()

export function isolationMode(): "systemd" | "container" {
  const mode = process.env.AIRDESIGN_ISOLATION ?? "systemd"
  if (mode !== "systemd" && mode !== "container") throw new Error("AIRDESIGN_ISOLATION must be systemd or container")
  return mode
}

export function spawnContainerJob(directory:string, program:string,started?:(pid:number)=>void): ChildProcess {
  const exporting=program.endsWith("/export/entry.ts")
  const limits = exporting ? [`--cpu=${exportLimits.cpuSeconds}:${exportLimits.cpuSeconds+1}`] : ["--cpu=25", "--as=8589934592", "--data=805306368"]
  const child = spawn("tini", ["-s", "-g", "--", process.execPath, path.join(import.meta.dirname, "container-supervisor.ts"), program, String(process.pid), JSON.stringify(limits), processIdentity(process.pid)?.identity ?? ""], {
    cwd:directory, detached:true, stdio:["pipe","ignore","pipe"],
    env:{PATH:process.env.PATH,HOME:directory,TMPDIR:directory,AIRDESIGN_JOB_DIRECTORY:directory,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(),".cache/ms-playwright")},
  })
  if (child.pid) {
    const root = processIdentity(child.pid)
    if (root) roots.set(child, root)
  }
  if(child.pid){try{started?.(child.pid);child.stdin?.end("start")}catch(error){killContainerJob(child);throw error}}
  const kill = () => killContainerJob(child)
  process.once("SIGTERM",kill)
  process.once("SIGINT",kill)
  child.once("exit",() => { kill(); process.removeListener("SIGTERM",kill); process.removeListener("SIGINT",kill) })
  return child
}

export function killContainerJob(child:ChildProcess): void {
  if (!child.pid) return
  const root = roots.get(child)
  if (root) cleanContainerJob(root)
}

export function containerJobRoot(child: ChildProcess): ProcessIdentity | undefined {
  return roots.get(child)
}
