import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const held = "AIRDESIGN_MACHINE_LOCK"
const onCi = (env) => env.CI === "true" || env.CI === "1"

export const machineLockFile = path.join(os.homedir(), ".cache", "airdesign", "machine.lock")

export const takeMachineLock = ({ file = machineLockFile, env = process.env, say = console.error } = {}) =>
  new Promise((resolve) => {
    const free = () => resolve(() => {})
    if (onCi(env) || env[held] === file) return free()
    if (spawnSync("flock", ["--version"]).status !== 0) return free()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (spawnSync("flock", ["-n", file, "true"]).status !== 0) {
      say("Another check is running on this machine. This one starts when it ends.")
    }
    const holder = spawn("flock", [file, "sh", "-c", "echo held; exec timeout 1200 cat"], {
      stdio: ["pipe", "pipe", "ignore"],
    })
    holder.on("error", free)
    holder.stdout.once("data", () => {
      env[held] = file
      holder.unref()
      holder.stdin.unref()
      holder.stdout.unref()
      resolve(
        () =>
          new Promise((freed) => {
            delete env[held]
            holder.ref()
            holder.once("exit", freed)
            holder.stdin.end()
          }),
      )
    })
  })
