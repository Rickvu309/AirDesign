import {spawn, type ChildProcess} from "node:child_process"
import path from "node:path"

export function isolationMode(): "systemd" | "container" {
  const mode = process.env.AIRDESIGN_ISOLATION ?? "systemd"
  if (mode !== "systemd" && mode !== "container") throw new Error("AIRDESIGN_ISOLATION must be systemd or container")
  return mode
}

export function spawnContainerJob(directory:string, program:string,started?:(pid:number)=>void): ChildProcess {
  const child = spawn("prlimit",["--cpu=25",program.endsWith("/export/entry.ts") ? "--as=4398046511104" : "--as=8589934592","--data=805306368","--fsize=524288000","--nofile=256","--",process.execPath,"--max-old-space-size=256","--disable-proto=throw","--import",path.join(import.meta.dirname,"container-network.ts"),path.join(import.meta.dirname,"container-entry.ts"),program,String(process.pid)],{
    cwd:directory, detached:true, stdio:["pipe","ignore","pipe"],
    env:{PATH:process.env.PATH,HOME:directory,TMPDIR:directory,AIRDESIGN_JOB_DIRECTORY:directory,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH},
  })
  if(child.pid){try{started?.(child.pid);child.stdin?.end("start")}catch(error){killContainerJob(child);throw error}}
  const kill = () => killContainerJob(child)
  process.once("SIGTERM",kill)
  process.once("SIGINT",kill)
  child.once("exit",() => { kill(); process.removeListener("SIGTERM",kill); process.removeListener("SIGINT",kill) })
  return child
}

export function killContainerJob(child:ChildProcess): void {
  if (!child.pid) return
  try { process.kill(-child.pid,"SIGKILL") } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error }
}
