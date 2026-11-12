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

export type AiraEnd = "working" | "done" | "stopped" | "failed" | "out-of-usage" | "signed-out" | "undone"

export type AiraExchange = {
  readonly asked: string
  readonly steps: readonly AiraStep[]
  readonly end: AiraEnd
  readonly runs: readonly string[]
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
  | { readonly type: "end"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }
  | { readonly type: "undone"; readonly exchange: number }

export type AskOptions = {
  readonly signal: AbortSignal
  readonly show: (chat: AiraChat) => void
  readonly added?: () => string | undefined
  readonly fetch?: typeof fetch
}

type Turned =
  | { readonly kind: "replied"; readonly content: readonly ReplyBlock[]; readonly usage: WeekUsage }
  | { readonly kind: "ended"; readonly end: AiraEnd; readonly usage?: WeekUsage | undefined }

type Called = { readonly answer: ToolAnswer; readonly ok: boolean; readonly run: string | undefined }

const accept = "application/json, text/event-stream"

const tools = projectTools(catalog)
const opOf: ReadonlyMap<string, AgentOp> = new Map(tools.map((tool) => [tool.name, tool.op]))
const stopTool = tools.find((tool) => tool.op === "stop_run")?.name ?? ""

export function airaChat(deck: string): AiraChat {
  return { deck, history: [], answers: [], exchanges: [], usage: null }
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
        runs: run === undefined || last.runs.includes(run) ? last.runs : [...last.runs, run],
      }))
    }
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
  return { kind: "ended", end: "failed", usage }
}

async function takeTurn(
  send: typeof fetch,
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
      body: JSON.stringify({ deck, messages }),
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

async function sendTool(send: typeof fetch, rpc: number, name: string, input: unknown) {
  const response = await send(mcpRoutes.mcp.path, {
    method: mcpRoutes.mcp.method,
    headers: { "content-type": "application/json", accept },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpc, method: "tools/call", params: { name, arguments: input } }),
  })
  return toolOutcome(await response.text())
}

async function callTool(send: typeof fetch, rpc: number, call: ToolCall): Promise<Called> {
  try {
    const outcome = await sendTool(send, rpc, call.name, call.input)
    const run = outcome.fields?.runId
    const edited = outcome.ok && opOf.get(call.name) === "edit_deck" && typeof run === "string"
    return { answer: toolAnswer(call.id, outcome.text, outcome.ok), ok: outcome.ok, run: edited ? run : undefined }
  } catch {
    return {
      answer: toolAnswer(call.id, "The call did not reach the server. Nothing landed.", false),
      ok: false,
      run: undefined,
    }
  }
}

function stoppedAnswer(call: ToolCall): ToolAnswer {
  return toolAnswer(call.id, "The person stopped the run before this call. Nothing landed.", false)
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

export async function askAira(start: AiraChat, asked: string, options: AskOptions): Promise<AiraChat> {
  const send = options.fetch ?? fetch
  const { signal } = options
  let chat = start
  function update(event: AiraEvent) {
    chat = airaStep(chat, event)
    options.show(chat)
  }
  update({ type: "ask", text: asked })
  let sent = userMessage(start.answers, asked)
  const closed = new Set<string>()
  let rpc = 1
  for (;;) {
    const turned = await takeTurn(send, chat.deck, [...chat.history, sent], signal, update)
    if (turned.kind === "ended") {
      update({ type: "end", end: turned.end, usage: turned.usage })
      break
    }
    update({ type: "replied", sent, content: turned.content, usage: turned.usage })
    const calls = turned.content.filter((block) => block.type === "tool_use")
    if (calls.length === 0) {
      update({ type: "end", end: "done" })
      break
    }
    for (const call of calls) {
      if (signal.aborted) {
        update({ type: "answered", answer: stoppedAnswer(call), state: "stopped", run: undefined })
        continue
      }
      const called = await callTool(send, rpc, call)
      rpc += 1
      const runId = call.input.runId
      if (called.ok && call.name === stopTool && typeof runId === "string") closed.add(runId)
      update({ type: "answered", answer: called.answer, state: called.ok ? "done" : "refused", run: called.run })
    }
    if (signal.aborted) {
      update({ type: "end", end: "stopped" })
      break
    }
    const more = options.added?.()
    if (more !== undefined) update({ type: "add", text: more })
    sent = userMessage(chat.answers, more)
  }
  const open = (chat.exchanges.at(-1)?.runs ?? []).filter((runId) => !closed.has(runId))
  await closeRuns(send, chat.deck, open, rpc)
  return chat
}

export async function undoExchange(
  chat: AiraChat,
  exchange: number,
  send: typeof fetch = fetch,
): Promise<AiraChat | undefined> {
  const found = chat.exchanges[exchange]
  if (found === undefined || found.end === "working" || found.end === "undone" || found.runs.length === 0) {
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
      if (!undone.ok) return undefined
    } catch {
      return undefined
    }
  }
  return airaStep(chat, { type: "undone", exchange })
}
