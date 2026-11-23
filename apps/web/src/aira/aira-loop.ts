import {
  airaRoutes,
  catalog,
  mcpRoutes,
  onceMeta,
  projectTools,
  sentWithoutPictures,
  type AgentOp,
  type ModelMessage,
  type ReplyBlock,
  type ToolAnswer,
  type ToolCall,
} from "@airdesign/catalog"
import { cappedPictures, toolAnswer } from "@/aira/aira-answers"
import { airaLine, bodyLines, toolOutcome, weekUsage, type WeekUsage } from "@/aira/aira-wire"
import { fieldsOf } from "@/lib/fields-of"

export type ToolState = "working" | "done" | "refused" | "stopped"

export type AiraStep =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "added"; readonly text: string }
  | {
      readonly kind: "tool"
      readonly id: string
      readonly name: string
      readonly state: ToolState
      readonly refusal?: string
    }
  | { readonly kind: "retry" }

export type AiraEnd =
  | "working"
  | "done"
  | "stopped"
  | "failed"
  | "out-of-usage"
  | "signed-out"
  | "country"
  | "off"
  | "malformed"
  | "undone"

export type AiraExchange = {
  readonly asked: string
  readonly steps: readonly AiraStep[]
  readonly end: AiraEnd
  readonly runs: readonly string[]
  readonly undoRefused?: true
  readonly undoFailed?: true
}

export type AiraChat = {
  readonly deck: string
  readonly history: readonly ModelMessage[]
  readonly answers: readonly ToolAnswer[]
  readonly exchanges: readonly AiraExchange[]
  readonly usage: WeekUsage | null
}

export type AiraEvent =
  | { readonly type: "ask"; readonly text: string }
  | { readonly type: "retry" }
  | { readonly type: "add"; readonly text: string }
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "tool"; readonly id: string; readonly name: string }
  | {
      readonly type: "replied"
      readonly sent: ModelMessage
      readonly content: readonly ReplyBlock[]
      readonly usage: WeekUsage
    }
  | {
      readonly type: "answered"
      readonly answer: ToolAnswer
      readonly state: ToolState
      readonly run: string | undefined
      readonly refusal?: string | undefined
    }
  | { readonly type: "landed"; readonly run: string; readonly id: string }
  | { readonly type: "end"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }
  | { readonly type: "undone"; readonly exchange: number }
  | { readonly type: "undo-refused"; readonly exchange: number }
  | { readonly type: "undo-failed"; readonly exchange: number; readonly runs: readonly string[] }

export type AskOptions = {
  readonly signal: AbortSignal
  readonly show: (chat: AiraChat) => void
  readonly added?: () => string | undefined
  readonly fetch?: typeof fetch
  readonly mint?: () => string
  readonly after?: Promise<AiraChat | undefined>
  readonly opened?: Promise<unknown>
}

type Turned =
  | { readonly kind: "replied"; readonly content: readonly ReplyBlock[]; readonly usage: WeekUsage }
  | { readonly kind: "ended"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }

type Called = {
  readonly answer: ToolAnswer
  readonly ok: boolean
  readonly run: string | undefined
  readonly stopped?: true
  readonly cut?: string
  readonly refusal?: string
}

const accept = "application/json, text/event-stream"
const tools = projectTools(catalog)
const opOf: ReadonlyMap<string, AgentOp> = new Map(tools.map((tool) => [tool.name, tool.op]))
const stopTool = tools.find((tool) => tool.op === "stop_run")?.name ?? ""

export function airaChat(deck: string): AiraChat {
  return { deck, history: [], answers: [], exchanges: [], usage: null }
}

function withRun(runs: readonly string[], run: string | undefined): readonly string[] {
  return run === undefined || runs.includes(run) ? runs : [...runs, run]
}

function changeLast(chat: AiraChat, change: (exchange: AiraExchange) => AiraExchange): AiraChat {
  const last = chat.exchanges.at(-1)
  if (last === undefined) return chat
  return { ...chat, exchanges: [...chat.exchanges.slice(0, -1), change(last)] }
}

function said(steps: readonly AiraStep[], text: string): readonly AiraStep[] {
  const last = steps.at(-1)
  if (last?.kind !== "text") return [...steps, { kind: "text", text }]
  return [...steps.slice(0, -1), { kind: "text", text: `${last.text}${text}` }]
}

function calling(steps: readonly AiraStep[], content: readonly ReplyBlock[]): readonly AiraStep[] {
  const shown = new Set(steps.flatMap((step) => (step.kind === "tool" ? [step.id] : [])))
  const missing = content.flatMap((block): AiraStep[] =>
    block.type === "tool_use" && !shown.has(block.id)
      ? [{ kind: "tool", id: block.id, name: block.name, state: "working" }]
      : [],
  )
  return [...steps, ...missing]
}

function settled(
  steps: readonly AiraStep[],
  id: string,
  state: ToolState,
  refusal: string | undefined,
): readonly AiraStep[] {
  return steps.map((step) => {
    if (step.kind !== "tool" || step.id !== id) return step
    return state === "refused" && refusal !== undefined ? { ...step, state, refusal } : { ...step, state }
  })
}

function changeAt(chat: AiraChat, at: number, change: (exchange: AiraExchange) => AiraExchange): AiraChat {
  return { ...chat, exchanges: chat.exchanges.map((exchange, index) => (index === at ? change(exchange) : exchange)) }
}

function withoutFailure({ undoFailed: _, ...exchange }: AiraExchange): AiraExchange {
  return exchange
}

function ended(steps: readonly AiraStep[]): readonly AiraStep[] {
  return steps.map((step) => (step.kind === "tool" && step.state === "working" ? { ...step, state: "stopped" } : step))
}

export function airaStep(chat: AiraChat, event: AiraEvent): AiraChat {
  switch (event.type) {
    case "ask":
      return { ...chat, exchanges: [...chat.exchanges, { asked: event.text, steps: [], end: "working", runs: [] }] }
    case "retry":
      return changeLast(chat, (last) => ({ ...last, steps: [...last.steps, { kind: "retry" }], end: "working" }))
    case "add":
      return changeLast(chat, (last) => ({ ...last, steps: [...last.steps, { kind: "added", text: event.text }] }))
    case "text":
      return changeLast(chat, (last) => ({ ...last, steps: said(last.steps, event.text) }))
    case "tool":
      return changeLast(chat, (last) => ({
        ...last,
        steps: [...last.steps, { kind: "tool", id: event.id, name: event.name, state: "working" }],
      }))
    case "replied": {
      const next: AiraChat = {
        ...chat,
        history: [...chat.history, sentWithoutPictures(event.sent), { role: "assistant", content: event.content }],
        answers: [],
        usage: event.usage,
      }
      return changeLast(next, (last) => ({ ...last, steps: calling(last.steps, event.content) }))
    }
    case "answered": {
      const { answer, run, state, refusal } = event
      const next = { ...chat, answers: [...chat.answers, answer] }
      return changeLast(next, (last) => ({
        ...last,
        steps: settled(last.steps, answer.tool_use_id, state, refusal),
        runs: withRun(last.runs, run),
      }))
    }
    case "landed":
      return changeLast(chat, (last) => ({
        ...last,
        steps: settled(last.steps, event.id, "done", undefined),
        runs: withRun(last.runs, event.run),
      }))
    case "end": {
      const next = event.usage === undefined ? chat : { ...chat, usage: event.usage }
      return changeLast(next, (last) => ({ ...last, end: event.end, steps: ended(last.steps) }))
    }
    case "undone":
      return changeAt(chat, event.exchange, (exchange) => ({ ...withoutFailure(exchange), end: "undone" }))
    case "undo-refused":
      return changeAt(chat, event.exchange, (exchange) => ({ ...withoutFailure(exchange), undoRefused: true }))
    case "undo-failed":
      return changeAt(chat, event.exchange, (exchange) => ({ ...exchange, runs: event.runs, undoFailed: true }))
  }
}

function userMessage(given: readonly ToolAnswer[], text: string | undefined): ModelMessage {
  const answers = cappedPictures(given)
  if (answers.length === 0) return { role: "user", content: text ?? "" }
  return { role: "user", content: text === undefined ? answers : [...answers, { type: "text", text }] }
}

async function refusedTurn(response: Response): Promise<Turned> {
  const body = fieldsOf(await response.json().catch(() => undefined))
  const usage = weekUsage(body?.usage)
  if (response.status === 402) return { kind: "ended", end: "out-of-usage", usage }
  if (response.status === 401) return { kind: "ended", end: "signed-out", usage }
  if (response.status === 403 && body?.refusal === "country") return { kind: "ended", end: "country", usage }
  if (response.status === 403 && body?.refusal === "off") return { kind: "ended", end: "off", usage }
  if (response.status === 400) return { kind: "ended", end: "malformed", usage }
  return { kind: "ended", end: "failed", usage }
}

async function takeTurn(
  send: typeof fetch,
  ask: string,
  deck: string,
  messages: readonly ModelMessage[],
  signal: AbortSignal,
  update: (event: AiraEvent) => void,
): Promise<Turned> {
  const cut: Turned = { kind: "ended", end: "failed" }
  try {
    const response = await send(airaRoutes.turn.path, {
      method: airaRoutes.turn.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deck, messages, ask }),
      signal,
    })
    if (response.status !== 200 || response.body === null) return await refusedTurn(response)
    for await (const text of bodyLines(response.body)) {
      const line = airaLine(text)
      if (line === undefined) continue
      if (line.type === "text") update({ type: "text", text: line.text })
      else if (line.type === "tool") update({ type: "tool", id: line.id, name: line.name })
      else if (line.ok) return { kind: "replied", content: line.content, usage: line.usage }
      else return { kind: "ended", end: "failed", usage: line.usage }
    }
  } catch {
    return signal.aborted ? { kind: "ended", end: "stopped" } : cut
  }
  return signal.aborted ? { kind: "ended", end: "stopped" } : cut
}

async function sendTool(
  send: typeof fetch,
  rpc: number,
  name: string,
  input: unknown,
  signal?: AbortSignal,
  once?: string,
) {
  const meta = once === undefined ? {} : { _meta: { [onceMeta]: once } }
  const response = await send(mcpRoutes.mcp.path, {
    method: mcpRoutes.mcp.method,
    headers: { "content-type": "application/json", accept },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpc,
      method: "tools/call",
      params: { name, arguments: input, ...meta },
    }),
    ...(signal === undefined ? {} : { signal }),
  })
  return toolOutcome(await response.text())
}

function interruptedAnswer(call: ToolCall): ToolAnswer {
  return toolAnswer(
    call.id,
    changes(call)
      ? "The person stopped the run while this call was running. It may have landed: read the deck before relying on it."
      : "The person stopped the run while this call was running. Nothing changed.",
    false,
  )
}

function untilStopped(work: Promise<unknown>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    void work.then(() => resolve())
    signal.addEventListener("abort", () => resolve(), { once: true })
  })
}

function changes(call: ToolCall): boolean {
  return catalog[opOf.get(call.name) ?? "read_deck"].kind === "command"
}

async function callTool(
  send: typeof fetch,
  rpc: number,
  call: ToolCall,
  signal: AbortSignal,
  once: string,
  again = true,
): Promise<Called> {
  const sent = changes(call) ? once : undefined
  try {
    const outcome = await sendTool(send, rpc, call.name, call.input, signal, sent)
    const run = outcome.fields?.runId
    const edited = outcome.ok && changes(call) && typeof run === "string"
    const answer = toolAnswer(call.id, outcome.text, outcome.ok, outcome.pictures)
    const refusal = outcome.fields?.refusal
    if (outcome.ok || typeof refusal !== "string") return { answer, ok: outcome.ok, run: edited ? run : undefined }
    return { answer, ok: false, run: undefined, refusal }
  } catch {
    if (signal.aborted) {
      const stopped = { answer: interruptedAnswer(call), ok: false, run: undefined, stopped: true } as const
      return sent === undefined ? stopped : { ...stopped, cut: sent }
    }
    if (sent !== undefined && again) return callTool(send, rpc, call, signal, once, false)
    const lost =
      sent === undefined
        ? "The call did not reach the server. Nothing landed."
        : "The call did not reach the server, or its answer was lost. Read the deck before sending it again."
    return { answer: toolAnswer(call.id, lost, false), ok: false, run: undefined, refusal: "unreached" }
  }
}

function stoppedAnswer(call: ToolCall): ToolAnswer {
  return toolAnswer(call.id, "The person stopped the run before this call. Nothing landed.", false)
}

async function stopAsk(send: typeof fetch, ask: string, call?: { deck: string; once: string }) {
  try {
    const response = await send(airaRoutes.stop.path, {
      method: airaRoutes.stop.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(call === undefined ? { ask } : { ask, call }),
    })
    const runId = fieldsOf(await response.json())?.runId
    return typeof runId === "string" ? runId : undefined
  } catch {
    return undefined
  }
}

async function closeRuns(send: typeof fetch, deck: string, runs: readonly string[], rpc: number): Promise<void> {
  for (const [index, runId] of runs.entries()) {
    try {
      await sendTool(send, rpc + index, stopTool, { deck, runId })
    } catch {
      continue
    }
  }
}

function continues(chat: AiraChat, before: AiraChat): boolean {
  return (
    chat.deck === before.deck &&
    before.exchanges.length <= chat.exchanges.length &&
    before.exchanges.every((exchange, index) => chat.exchanges[index]?.asked === exchange.asked)
  )
}

function landedIn(exchange: AiraExchange, before: AiraExchange | undefined): AiraExchange {
  const runs = (before?.runs ?? []).reduce(withRun, exchange.runs)
  return runs === exchange.runs ? exchange : { ...exchange, runs }
}

export function askAira(start: AiraChat, asked: string, options: AskOptions): Promise<AiraChat> {
  return converse(start, { type: "ask", text: asked }, userMessage(start.answers, asked), options)
}

export function retryAira(start: AiraChat, options: AskOptions): Promise<AiraChat> {
  const asked = start.exchanges.at(-1)?.asked ?? ""
  const waiting = start.answers.length > 0
  return converse(start, { type: "retry" }, userMessage(start.answers, waiting ? undefined : asked), options)
}

async function converse(
  start: AiraChat,
  first: AiraEvent,
  opening: ModelMessage,
  options: AskOptions,
): Promise<AiraChat> {
  const send = options.fetch ?? fetch
  const mint = options.mint ?? crypto.randomUUID.bind(crypto)
  const ask = mint()
  const { signal } = options
  const opened = Promise.resolve(options.opened).catch(() => undefined)
  let chat = start
  function update(event: AiraEvent) {
    chat = airaStep(chat, event)
    options.show(chat)
  }
  update(first)
  const before = await options.after
  if (before !== undefined && continues(chat, before)) {
    chat = { ...chat, exchanges: chat.exchanges.map((exchange, index) => landedIn(exchange, before.exchanges[index])) }
    options.show(chat)
  }
  let sent = opening
  const closed = new Set<string>(first.type === "retry" ? (chat.exchanges.at(-1)?.runs ?? []) : [])
  let rpc = 1
  let stopped: Promise<unknown> = Promise.resolve()
  let cut: { readonly once: string; readonly id: string } | undefined
  for (;;) {
    const turned = await takeTurn(send, ask, chat.deck, [...chat.history, sent], signal, update)
    if (turned.kind === "ended") {
      if (turned.end === "stopped") stopped = stopAsk(send, ask)
      update({ type: "end", end: turned.end, usage: turned.usage })
      break
    }
    update({ type: "replied", sent, content: turned.content, usage: turned.usage })
    const calls = turned.content.filter((block) => block.type === "tool_use")
    if (calls.length === 0) {
      update({ type: "end", end: "done" })
      break
    }
    await untilStopped(opened, signal)
    for (const call of calls) {
      if (signal.aborted) {
        update({ type: "answered", answer: stoppedAnswer(call), state: "stopped", run: undefined })
        continue
      }
      const called = await callTool(send, rpc, call, signal, `${ask}-${String(rpc)}`)
      rpc += 1
      const runId = call.input.runId
      if (called.ok && call.name === stopTool && typeof runId === "string") closed.add(runId)
      if (called.cut !== undefined) cut = { once: called.cut, id: call.id }
      const state = called.stopped === true ? "stopped" : called.ok ? "done" : "refused"
      update({ type: "answered", answer: called.answer, state, run: called.run, refusal: called.refusal })
    }
    if (signal.aborted) {
      update({ type: "end", end: "stopped" })
      break
    }
    const more = options.added?.()
    if (more !== undefined) update({ type: "add", text: more })
    sent = userMessage(chat.answers, more)
  }
  const landed = cut === undefined ? undefined : await stopAsk(send, ask, { deck: chat.deck, once: cut.once })
  if (landed !== undefined && cut !== undefined) update({ type: "landed", run: landed, id: cut.id })
  const open = (chat.exchanges.at(-1)?.runs ?? []).filter((runId) => !closed.has(runId))
  await Promise.all([stopped, closeRuns(send, chat.deck, open, rpc)])
  return chat
}

export type UndoRun = (deck: string, run: string) => Promise<"undone" | "refused" | "failed">

export async function undoExchange(chat: AiraChat, exchange: number, undo: UndoRun): Promise<AiraChat | undefined> {
  const found = chat.exchanges[exchange]
  if (
    found === undefined ||
    found.end === "working" ||
    found.end === "undone" ||
    found.undoRefused === true ||
    found.runs.length === 0
  ) {
    return undefined
  }
  for (const [index, runId] of [...found.runs].reverse().entries()) {
    const failed = airaStep(chat, {
      type: "undo-failed",
      exchange,
      runs: found.runs.slice(0, found.runs.length - index),
    })
    const result = await undo(chat.deck, runId)
    if (result === "refused") return airaStep(chat, { type: "undo-refused", exchange })
    if (result === "failed") return failed
  }
  return airaStep(chat, { type: "undone", exchange })
}
