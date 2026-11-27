import { parentPort, receiveMessageOnPort, type MessagePort } from "node:worker_threads"
import { newQuickJSWASMModuleFromVariant, type QuickJSContext, type QuickJSHandle } from "quickjs-emscripten-core"

export type ScriptLimits = {
  readonly memory: number
  readonly stack: number
  readonly logs: number
  readonly spinMs: number
}

export type ScriptJob = {
  readonly script: string
  readonly port: MessagePort
  readonly flag: Int32Array
}

export type ScriptStart = { readonly verbs: readonly string[]; readonly limits: ScriptLimits }

export type OpReply =
  | { readonly ok: true; readonly value?: unknown; readonly json?: string }
  | { readonly ok: false; readonly message: string }

export type FromScript =
  | { readonly kind: "op"; readonly verb: string; readonly json: string | undefined }
  | { readonly kind: "log"; readonly text: string }
  | { readonly kind: "done"; readonly ok: true; readonly result: unknown }
  | {
      readonly kind: "done"
      readonly ok: false
      readonly name: string
      readonly message: string
      readonly line?: number
    }

const quickjs = await newQuickJSWASMModuleFromVariant(import("@jitl/quickjs-wasmfile-release-sync"))

const shown = (value: unknown) => (typeof value === "string" ? value : (JSON.stringify(value) ?? String(value)))

function lineOf(stack: unknown): number | undefined {
  const found = /script\.js:(\d+)/.exec(typeof stack === "string" ? stack : "")
  return found === null ? undefined : Number(found[1])
}

function thrown(error: unknown): Omit<Extract<FromScript, { ok: false }>, "kind" | "ok"> {
  if (typeof error !== "object" || error === null) return { name: "Error", message: shown(error) }
  const { name, message, stack } = error as { name?: unknown; message?: unknown; stack?: unknown }
  const line = lineOf(stack)
  return {
    name: typeof name === "string" ? name : "Error",
    message: typeof message === "string" ? message : shown(error),
    ...(line === undefined ? {} : { line }),
  }
}

type Sandbox = { readonly vm: QuickJSContext; readonly dispose: () => void; job?: ScriptJob }

function sandbox(start: ScriptStart): Sandbox {
  const vm = quickjs.newContext()
  vm.runtime.setMemoryLimit(start.limits.memory)
  vm.runtime.setMaxStackSize(start.limits.stack)
  const json = vm.getProp(vm.global, "JSON")
  const parse = vm.getProp(json, "parse")
  const stringify = vm.getProp(json, "stringify")
  json.dispose()
  const box: Sandbox = {
    vm,
    dispose: () => {
      parse.dispose()
      stringify.dispose()
      vm.dispose()
    },
  }
  const send = (message: FromScript) => box.job?.port.postMessage(message)
  const textOf = (arg: QuickJSHandle | undefined) => {
    if (arg === undefined) return undefined
    const text = vm.unwrapResult(vm.callFunction(stringify, vm.undefined, arg))
    try {
      return vm.typeof(text) === "string" ? vm.getString(text) : undefined
    } finally {
      text.dispose()
    }
  }
  const intoScript = (reply: Extract<OpReply, { ok: true }>): QuickJSHandle => {
    if (typeof reply.value === "string") return vm.newString(reply.value)
    if (reply.json === undefined) return vm.undefined
    const text = vm.newString(reply.json)
    try {
      return vm.unwrapResult(vm.callFunction(parse, vm.undefined, text))
    } finally {
      text.dispose()
    }
  }
  for (const verb of start.verbs) {
    const operation = vm.newFunction(verb, (arg) => {
      const job = box.job
      if (job === undefined) throw new Error(`${verb} has no script to answer.`)
      send({ kind: "op", verb, json: textOf(arg) })
      const until = performance.now() + start.limits.spinMs
      while (Atomics.load(job.flag, 0) === 0 && performance.now() < until);
      Atomics.wait(job.flag, 0, 0)
      Atomics.store(job.flag, 0, 0)
      const reply = receiveMessageOnPort(job.port)?.message as OpReply | undefined
      if (reply === undefined) throw new Error(`${verb} got no answer.`)
      if (!reply.ok) throw new Error(reply.message)
      return intoScript(reply)
    })
    vm.setProp(vm.global, verb, operation)
    operation.dispose()
  }
  let printed = 0
  const print = vm.newFunction("print", (...args) => {
    printed += 1
    if (printed <= start.limits.logs) send({ kind: "log", text: args.map((each) => shown(vm.dump(each))).join(" ") })
  })
  const logger = vm.newObject()
  vm.setProp(logger, "log", print)
  vm.setProp(vm.global, "console", logger)
  vm.setProp(vm.global, "print", print)
  logger.dispose()
  print.dispose()
  return box
}

function run(box: Sandbox, job: ScriptJob): void {
  box.job = job
  const { vm } = box
  const send = (message: FromScript) => job.port.postMessage(message)
  try {
    const ran = vm.evalCode(job.script, "script.js")
    if (ran.error) {
      const error = vm.dump(ran.error) as unknown
      ran.error.dispose()
      send({ kind: "done", ok: false, ...thrown(error) })
    } else {
      const result = vm.dump(ran.value) as unknown
      ran.value.dispose()
      send({ kind: "done", ok: true, result })
    }
  } catch (error) {
    send({ kind: "done", ok: false, ...thrown(error) })
  } finally {
    box.dispose()
    job.port.close()
  }
}

const start = (await new Promise((resolve) => parentPort?.once("message", resolve))) as ScriptStart
let ready = sandbox(start)
parentPort?.on("message", (job: ScriptJob) => {
  const box = ready
  run(box, job)
  ready = sandbox(start)
})
