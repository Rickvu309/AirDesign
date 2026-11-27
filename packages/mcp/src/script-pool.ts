import { availableParallelism } from "node:os"
import { extname } from "node:path"
import { fileURLToPath } from "node:url"
import { MessageChannel, Worker } from "node:worker_threads"

import type { FromScript, OpReply, ScriptJob, ScriptStart } from "./script-worker.js"

export const scriptLimits = {
  ms: 20_000,
  memory: 64 * 1024 * 1024,
  stack: 1024 * 1024,
  logs: 50,
} as const

export type ScriptEnd =
  | { readonly ok: true; readonly result: unknown; readonly logs: readonly string[] }
  | {
      readonly ok: false
      readonly stop: "threw" | "time" | "crash" | "busy"
      readonly name?: string
      readonly message?: string
      readonly line?: number
      readonly logs: readonly string[]
    }

export type Answer = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string }
export type Operation = (verb: string, fields: unknown) => Promise<Answer>

type Run = { readonly account: string; readonly script: string; readonly operation: Operation; readonly ms?: number }
type Borrowed = Worker | "busy" | "crash"

const workerFile = new URL(`./script-worker${extname(fileURLToPath(import.meta.url))}`, import.meta.url)
const cores = availableParallelism()
const poolSize = Math.max(2, Math.min(4, cores - 1))
const spinMs = cores >= 4 ? 1 : 0

function replyOf(answer: Answer): OpReply {
  if (!answer.ok) return answer
  return typeof answer.value === "string" || answer.value === undefined
    ? { ok: true, value: answer.value }
    : { ok: true, json: JSON.stringify(answer.value) }
}

export function scriptPool(verbs: readonly string[]) {
  const idle: Worker[] = []
  const running = new Set<string>()
  const waiting = new Map<string, (borrowed: Borrowed) => void>()

  function startWorker(): Worker {
    const worker = new Worker(workerFile)
    const start: ScriptStart = {
      verbs,
      limits: { memory: scriptLimits.memory, stack: scriptLimits.stack, logs: scriptLimits.logs, spinMs },
    }
    worker.postMessage(start)
    worker.unref()
    worker.once("exit", () => {
      const at = idle.indexOf(worker)
      if (at < 0) return
      idle.splice(at, 1)
    })
    return worker
  }

  function wake(): void {
    if (running.size >= poolSize) return
    for (const [account, take] of waiting) {
      if (running.has(account)) continue
      waiting.delete(account)
      let worker: Worker
      try {
        worker = idle.pop() ?? startWorker()
      } catch {
        take("crash")
        continue
      }
      running.add(account)
      take(worker)
      return
    }
  }

  function borrow(account: string): Promise<Borrowed> {
    if (waiting.has(account)) return Promise.resolve("busy")
    return new Promise((resolve) => {
      waiting.set(account, resolve)
      wake()
    })
  }

  async function run({ account, script, operation, ms = scriptLimits.ms }: Run): Promise<ScriptEnd> {
    const worker = await borrow(account)
    if (typeof worker === "string") return { ok: false, stop: worker, logs: [] }
    const { port1, port2 } = new MessageChannel()
    const flag = new Int32Array(new SharedArrayBuffer(4))
    const logs: string[] = []
    return new Promise((resolve) => {
      let settled = false
      const release = () => {
        running.delete(account)
        wake()
      }
      const finish = (end: ScriptEnd, keep: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.off("error", crashed)
        worker.off("exit", crashed)
        port1.close()
        if (keep) {
          idle.push(worker)
          release()
        } else {
          void worker.terminate().then(release, release)
        }
        resolve(end)
      }
      const crashed = () => finish({ ok: false, stop: "crash", logs }, false)
      const timer = setTimeout(() => finish({ ok: false, stop: "time", logs }, false), ms)
      worker.once("error", crashed)
      worker.once("exit", crashed)
      port1.on("message", (message: FromScript) => {
        if (message.kind === "log") {
          logs.push(message.text)
          return
        }
        if (message.kind === "done") {
          const { kind: _kind, ...end } = message
          finish(end.ok ? { ...end, logs } : { ...end, stop: "threw", logs }, true)
          return
        }
        void operation(message.verb, message.json === undefined ? undefined : JSON.parse(message.json))
          .catch((error: unknown): Answer => ({ ok: false, message: `${message.verb} failed: ${String(error)}` }))
          .then((answer) => {
            if (settled) return
            port1.postMessage(replyOf(answer))
            Atomics.store(flag, 0, 1)
            Atomics.notify(flag, 0)
          })
      })
      const job: ScriptJob = { script, port: port2, flag }
      try {
        worker.postMessage(job, [port2])
      } catch {
        port2.close()
        crashed()
      }
    })
  }

  return { run }
}
