import {
  airaRoutes,
  catalog,
  deckRoutes,
  mcpRoutes,
  projectTools,
  type AgentOp,
  type ModelMessage,
  type ReplyBlock,
  type ToolAnswer,
  type ToolCall,
} from "@airdesign/catalog"
import { airaLine, bodyLines, fieldsOf, toolOutcome, weekUsage, type WeekUsage } from "@/aira-wire"

export type ToolState = "working" | "done" | "refused" | "stopped"

export type AiraStep =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "added"; readonly text: string }
  | { readonly kind: "tool"; readonly id: string; readonly name: string; readonly state: ToolState }

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
    }
  | { readonly type: "landed"; readonly run: string }
  | { readonly type: "end"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }
  | { readonly type: "undone"; readonly exchange: number }
  | { readonly type: "undo-refused"; readonly exchange: number }

export type AskOptions = {
  readonly signal: AbortSignal
  readonly show: (chat: AiraChat) => void
  readonly added?: () => string | undefined
  readonly fetch?: typeof fetch
  readonly mint?: () => string
  readonly after?: Promise<AiraChat | undefined>
  readonly opened?: Promise<unknown>
  readonly pause?: (ms: number, signal: AbortSignal) => Promise<void>
}

type Turned =
  | { readonly kind: "replied"; readonly content: readonly ReplyBlock[]; readonly usage: WeekUsage }
  | { readonly kind: "ended"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }

type Called = {
  readonly answer: ToolAnswer
  readonly ok: boolean
  readonly run: string | undefined
  readonly stopped?: true
  readonly landing?: Promise<string | undefined>
}

const indexingTries = 15
const indexingPause = 1000
const landingWait = 10_000
const accept = "application/json, text/event-stream"
const lasting: ReadonlySet<string> = new Set(["run-fenced", "person-protected", "dead"])

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

function settled(steps: readonly AiraStep[], id: string, state: ToolState): readonly AiraStep[] {
  return steps.map((step) => (step.kind === "tool" && step.id === id ? { ...step, state } : step))
}

function ended(steps: readonly AiraStep[]): readonly AiraStep[] {
  return steps.map((step) => (step.kind === "tool" && step.state === "working" ? { ...step, state: "stopped" } : step))
}

export function airaStep(chat: AiraChat, event: AiraEvent): AiraChat {
  switch (event.type) {
    case "ask":
      return { ...chat, exchanges: [...chat.exchanges, { asked: event.text, steps: [], end: "working", runs: [] }] }
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
        history: [...chat.history, event.sent, { role: "assistant", content: event.content }],
        answers: [],
        usage: event.usage,
      }
      return changeLast(next, (last) => ({ ...last, steps: calling(last.steps, event.content) }))
    }
    case "answered": {
      const { answer, run, state } = event
      const next = { ...chat, answers: [...chat.answers, answer] }
      return changeLast(next, (last) => ({
        ...last,
        steps: settled(last.steps, answer.tool_use_id, state),
        runs: withRun(last.runs, run),
      }))
    }
    case "landed":
      return changeLast(chat, (last) => ({ ...last, runs: withRun(last.runs, event.run) }))
    case "end": {
      const next = event.usage === undefined ? chat : { ...chat, usage: event.usage }
      return changeLast(next, (last) => ({ ...last, end: event.end, steps: ended(last.steps) }))
    }
    case "undone":
      return {
        ...chat,
        exchanges: chat.exchanges.map((exchange, index) =>
          index === event.exchange ? { ...exchange, end: "undone" } : exchange,
        ),
      }
    case "undo-refused":
      return {
        ...chat,
        exchanges: chat.exchanges.map((exchange, index) =>
          index === event.exchange ? { ...exchange, undoRefused: true } : exchange,
        ),
      }
  }
}

function userMessage(answers: readonly ToolAnswer[], text: string | undefined): ModelMessage {
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

function toolAnswer(id: string, text: string, ok: boolean): ToolAnswer {
  return ok
    ? { type: "tool_result", tool_use_id: id, content: text }
    : { type: "tool_result", tool_use_id: id, content: text, is_error: true }
}

async function sendTool(send: typeof fetch, rpc: number, name: string, input: unknown, signal?: AbortSignal) {
  const response = await send(mcpRoutes.mcp.path, {
    method: mcpRoutes.mcp.method,
    headers: { "content-type": "application/json", accept },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpc, method: "tools/call", params: { name, arguments: input } }),
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

function pauseFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function changes(call: ToolCall): boolean {
  return catalog[opOf.get(call.name) ?? "read_deck"].kind === "command"
}

async function sendCall(
  send: typeof fetch,
  rpc: number,
  call: ToolCall,
  signal: AbortSignal,
  cut: AbortSignal,
  pause: NonNullable<AskOptions["pause"]>,
): Promise<Called> {
  try {
    let outcome = await sendTool(send, rpc, call.name, call.input, cut)
    for (
      let tried = 0;
      outcome.fields?.refusal === "indexing" && tried < indexingTries && !signal.aborted;
      tried += 1
    ) {
      await pause(indexingPause, signal)
      if (signal.aborted) break
      outcome = await sendTool(send, rpc, call.name, call.input, cut)
    }
    const run = outcome.fields?.runId
    const edited = outcome.ok && changes(call) && typeof run === "string"
    return { answer: toolAnswer(call.id, outcome.text, outcome.ok), ok: outcome.ok, run: edited ? run : undefined }
  } catch {
    if (signal.aborted) return { answer: interruptedAnswer(call), ok: false, run: undefined, stopped: true }
    return {
      answer: toolAnswer(call.id, "The call did not reach the server. Nothing landed.", false),
      ok: false,
      run: undefined,
    }
  }
}

async function callTool(
  send: typeof fetch,
  rpc: number,
  call: ToolCall,
  signal: AbortSignal,
  pause: NonNullable<AskOptions["pause"]>,
): Promise<Called> {
  if (!changes(call)) return sendCall(send, rpc, call, signal, signal, pause)
  const cut = new AbortController()
  const sending = sendCall(send, rpc, call, signal, cut.signal, pause)
  const answered = await Promise.race([sending, untilStopped(sending, signal).then(() => undefined)])
  if (answered !== undefined) return answered
  const waited = new AbortController()
  const landing = Promise.race([
    sending.then((called) => called.run),
    pause(landingWait, waited.signal).then(() => undefined),
  ]).finally(() => {
    waited.abort()
    cut.abort()
  })
  return { answer: interruptedAnswer(call), ok: false, run: undefined, stopped: true, landing }
}

function stoppedAnswer(call: ToolCall): ToolAnswer {
  return toolAnswer(call.id, "The person stopped the run before this call. Nothing landed.", false)
}

async function stopAsk(send: typeof fetch, ask: string): Promise<void> {
  try {
    await send(airaRoutes.stop.path, {
      method: airaRoutes.stop.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ask }),
    })
  } catch {
    return
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
    before.exchanges.length < chat.exchanges.length &&
    before.exchanges.every((exchange, index) => chat.exchanges[index]?.asked === exchange.asked)
  )
}

function landedIn(exchange: AiraExchange, before: AiraExchange | undefined): AiraExchange {
  const runs = (before?.runs ?? []).reduce(withRun, exchange.runs)
  return runs === exchange.runs ? exchange : { ...exchange, runs }
}

export async function askAira(start: AiraChat, asked: string, options: AskOptions): Promise<AiraChat> {
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
  update({ type: "ask", text: asked })
  const before = await options.after
  if (before !== undefined && continues(chat, before)) {
    chat = { ...chat, exchanges: chat.exchanges.map((exchange, index) => landedIn(exchange, before.exchanges[index])) }
    options.show(chat)
  }
  let sent = userMessage(start.answers, asked)
  const closed = new Set<string>()
  let rpc = 1
  let stopped: Promise<void> = Promise.resolve()
  const landing: Promise<string | undefined>[] = []
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
      const called = await callTool(send, rpc, call, signal, options.pause ?? pauseFor)
      rpc += 1
      const runId = call.input.runId
      if (called.ok && call.name === stopTool && typeof runId === "string") closed.add(runId)
      if (called.landing !== undefined) landing.push(called.landing)
      const state = called.stopped === true ? "stopped" : called.ok ? "done" : "refused"
      update({ type: "answered", answer: called.answer, state, run: called.run })
    }
    if (signal.aborted) {
      update({ type: "end", end: "stopped" })
      break
    }
    const more = options.added?.()
    if (more !== undefined) update({ type: "add", text: more })
    sent = userMessage(chat.answers, more)
  }
  for (const run of await Promise.all(landing)) if (run !== undefined) update({ type: "landed", run })
  const open = (chat.exchanges.at(-1)?.runs ?? []).filter((runId) => !closed.has(runId))
  await Promise.all([stopped, closeRuns(send, chat.deck, open, rpc)])
  return chat
}

export async function undoExchange(
  chat: AiraChat,
  exchange: number,
  send: typeof fetch = fetch,
): Promise<AiraChat | undefined> {
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
  for (const runId of [...found.runs].reverse()) {
    try {
      const response = await send(deckRoutes.undo.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck: chat.deck, runId }),
      })
      const undone = deckRoutes.undo.result(await response.json())
      if (!undone.ok)
        return lasting.has(undone.refusal) ? airaStep(chat, { type: "undo-refused", exchange }) : undefined
    } catch {
      return undefined
    }
  }
  return airaStep(chat, { type: "undone", exchange })
}
