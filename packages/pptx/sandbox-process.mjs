import { fork } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function readRss(pid) {
  const text = readFileSync(`/proc/${pid}/status`, "utf8")
  for (const line of text.split("\n")) {
    if (!line.startsWith("VmRSS:")) continue
    const kb = Number(line.trim().split(/\s+/)[1])
    if (!Number.isFinite(kb)) break
    return kb * 1024
  }
  throw new Error("rss")
}

export function openSandbox() {
  const child = fork(fileURLToPath(new URL("./sandbox-child.mjs", import.meta.url)), [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  })
  if (child.pid === undefined) throw new Error("process")
  const pid = child.pid
  const messages = []
  const waiters = []
  let killed = false
  child.on("message", (message) => {
    const waiter = waiters.shift()
    if (waiter === undefined) messages.push(message)
    else waiter(message)
  })
  return {
    rss() {
      return readRss(pid)
    },
    kill() {
      if (killed) return
      killed = true
      child.kill("SIGKILL")
    },
    killed() {
      return killed
    },
    send(message) {
      child.send(message)
    },
    next() {
      const queued = messages.shift()
      if (queued !== undefined) return Promise.resolve(queued)
      return new Promise((resolve) => {
        waiters.push(resolve)
      })
    },
    close() {
      if (!killed && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
      killed = true
    },
  }
}
