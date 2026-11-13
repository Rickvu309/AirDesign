import { catalog, projectTools, toolInputSchema } from "./catalog.js"
import { deckPattern, readDeckId, type DeckId } from "./wire.js"

export const airaTextCap = 8000
export const airaMessageCap = 199

export type TextBlock = { readonly type: "text"; readonly text: string }

export type ToolCall = {
  readonly type: "tool_use"
  readonly id: string
  readonly name: string
  readonly input: Readonly<Record<string, unknown>>
}

export type ReplyBlock =
  | TextBlock
  | ToolCall
  | { readonly type: "thinking"; readonly thinking: string; readonly signature: string }
  | { readonly type: "redacted_thinking"; readonly data: string }

export type ToolAnswer = {
  readonly type: "tool_result"
  readonly tool_use_id: string
  readonly content: string
  readonly is_error?: boolean
}

export type ModelMessage =
  | { readonly role: "user"; readonly content: string | readonly (ToolAnswer | TextBlock)[] }
  | { readonly role: "assistant"; readonly content: readonly ReplyBlock[] }

export type ModelTool = {
  readonly name: string
  readonly description: string
  readonly input_schema: Readonly<Record<string, unknown>>
}

export type TurnRead =
  | {
      readonly ok: true
      readonly deck: DeckId
      readonly messages: readonly ModelMessage[]
      readonly ask: string | undefined
    }
  | { readonly ok: false }

export type StopCall = { readonly deck: DeckId; readonly once: string }

export type StopRead = { readonly ok: true; readonly ask: string; readonly call?: StopCall } | { readonly ok: false }

export const airaTools: readonly ModelTool[] = projectTools(catalog).map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: toolInputSchema(tool.op),
}))

const toolNames: ReadonlySet<string> = new Set(airaTools.map((tool) => tool.name))
const toolId = /^[A-Za-z0-9_-]{1,128}$/
const askId = /^[A-Za-z0-9_-]{1,64}$/

function fieldsOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function named(raw: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(raw)
  return (
    required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key))
  )
}

function personText(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length > 0 && raw.length <= airaTextCap
}

function replyBlock(raw: unknown): ReplyBlock | undefined {
  const block = fieldsOf(raw)
  if (block === undefined) return undefined
  if (block.type === "text" && named(block, ["type", "text"])) {
    return typeof block.text === "string" && block.text.length > 0 ? { type: "text", text: block.text } : undefined
  }
  if (block.type === "thinking" && named(block, ["type", "thinking", "signature"])) {
    if (typeof block.thinking !== "string" || typeof block.signature !== "string") return undefined
    return { type: "thinking", thinking: block.thinking, signature: block.signature }
  }
  if (block.type === "redacted_thinking" && named(block, ["type", "data"])) {
    return typeof block.data === "string" ? { type: "redacted_thinking", data: block.data } : undefined
  }
  if (block.type !== "tool_use" || !named(block, ["type", "id", "name", "input"])) return undefined
  const input = fieldsOf(block.input)
  if (typeof block.id !== "string" || !toolId.test(block.id) || input === undefined) return undefined
  if (typeof block.name !== "string" || !toolNames.has(block.name)) return undefined
  return { type: "tool_use", id: block.id, name: block.name, input }
}

function toolAnswer(raw: unknown, id: string): ToolAnswer | undefined {
  const block = fieldsOf(raw)
  if (block?.type !== "tool_result" || !named(block, ["type", "tool_use_id", "content"], ["is_error"])) return undefined
  if (block.tool_use_id !== id || typeof block.content !== "string") return undefined
  if (block.is_error === undefined) return { type: "tool_result", tool_use_id: id, content: block.content }
  if (typeof block.is_error !== "boolean") return undefined
  return { type: "tool_result", tool_use_id: id, content: block.content, is_error: block.is_error }
}

function added(raw: unknown): TextBlock | undefined {
  const block = fieldsOf(raw)
  if (block?.type !== "text" || !named(block, ["type", "text"]) || !personText(block.text)) return undefined
  return { type: "text", text: block.text }
}

function asked(raw: unknown, calls: readonly string[]): ModelMessage | undefined {
  const message = fieldsOf(raw)
  if (message?.role !== "user" || !named(message, ["role", "content"])) return undefined
  const content = message.content
  if (calls.length === 0) return personText(content) ? { role: "user", content } : undefined
  if (!Array.isArray(content) || content.length < calls.length || content.length > calls.length + 1) return undefined
  const answers = calls.map((id, index) => toolAnswer(content[index], id))
  const more = content.length > calls.length ? added(content[calls.length]) : null
  if (more === undefined || answers.some((answer) => answer === undefined)) return undefined
  const blocks = answers.filter((answer) => answer !== undefined)
  return { role: "user", content: more === null ? blocks : [...blocks, more] }
}

function replied(raw: unknown): (ModelMessage & { readonly role: "assistant" }) | undefined {
  const message = fieldsOf(raw)
  if (message?.role !== "assistant" || !named(message, ["role", "content"])) return undefined
  if (!Array.isArray(message.content) || message.content.length === 0) return undefined
  const blocks = message.content.map(replyBlock)
  if (blocks.some((block) => block === undefined)) return undefined
  const content = blocks.filter((block) => block !== undefined)
  const ids = content.flatMap((block) => (block.type === "tool_use" ? [block.id] : []))
  if (new Set(ids).size !== ids.length) return undefined
  return { role: "assistant", content }
}

export function readTurn(raw: unknown): TurnRead {
  const body = fieldsOf(raw)
  if (body === undefined || !named(body, ["deck", "messages"], ["ask"])) return { ok: false }
  const ask = body.ask
  if (ask !== undefined && !(typeof ask === "string" && askId.test(ask))) return { ok: false }
  const deck = readDeckId(body.deck)
  const list = body.messages
  if (!deck.ok || !Array.isArray(list) || list.length % 2 === 0 || list.length > airaMessageCap) return { ok: false }
  const messages: ModelMessage[] = []
  let calls: readonly string[] = []
  for (const [index, item] of list.entries()) {
    const message = index % 2 === 0 ? asked(item, calls) : replied(item)
    if (message === undefined) return { ok: false }
    calls =
      message.role === "assistant"
        ? message.content.flatMap((block) => (block.type === "tool_use" ? [block.id] : []))
        : []
    messages.push(message)
  }
  return { ok: true, deck: deck.deck, messages, ask }
}

function stopCall(raw: unknown): StopCall | undefined {
  const call = fieldsOf(raw)
  if (call === undefined || !named(call, ["deck", "once"])) return undefined
  const deck = readDeckId(call.deck)
  if (!deck.ok || typeof call.once !== "string" || !deckPattern.test(call.once)) return undefined
  return { deck: deck.deck, once: call.once }
}

export function readStop(raw: unknown): StopRead {
  const body = fieldsOf(raw)
  if (body === undefined || !named(body, ["ask"], ["call"]) || typeof body.ask !== "string" || !askId.test(body.ask)) {
    return { ok: false }
  }
  if (!Object.hasOwn(body, "call")) return { ok: true, ask: body.ask }
  const call = stopCall(body.call)
  return call === undefined ? { ok: false } : { ok: true, ask: body.ask, call }
}
