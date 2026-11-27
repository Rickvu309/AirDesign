import { catalog, projectTools, toolInputSchema } from "./catalog.js"
import { inlinedSchema } from "./shared-schema.js"
import { screenshotBytes, screenshotType } from "./slide-screenshots-wire.js"
import { deckPattern, readDeckId, type DeckId } from "./wire.js"

export const airaTextCap = 8000
export const airaMessageCap = 199
export const airaScreenshotCap = 10
export const airaScreenshotBytes = 730_000
export const screenshotNotFitted =
  "This slide's screenshot did not fit in one turn. Ask for a screenshot of this slide alone to see it."
export const screenshotTokenCeiling = 1_600
export const screenshotLeftOut = "A screenshot was here. Ask for a screenshot again to see the slide now."

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

export type ImageBlock = {
  readonly type: "image"
  readonly source: { readonly type: "base64"; readonly media_type: typeof screenshotType; readonly data: string }
}

export type ResultBlock = TextBlock | ImageBlock

export type ToolAnswer = {
  readonly type: "tool_result"
  readonly tool_use_id: string
  readonly content: string | readonly ResultBlock[]
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
  input_schema: inlinedSchema(toolInputSchema(tool.op)),
}))

const toolNames: ReadonlySet<string> = new Set(airaTools.map((tool) => tool.name))
const toolId = /^[A-Za-z0-9_-]{1,128}$/
const askId = /^[A-Za-z0-9_-]{1,64}$/
const base64 = /^[A-Za-z0-9+/]+={0,2}$/

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

function imageBlock(raw: Record<string, unknown>): ImageBlock | undefined {
  const source = fieldsOf(raw.source)
  if (!named(raw, ["type", "source"]) || source === undefined || !named(source, ["type", "media_type", "data"])) {
    return undefined
  }
  const { data } = source
  if (source.type !== "base64" || source.media_type !== screenshotType) return undefined
  if (typeof data !== "string" || data.length === 0 || data.length > screenshotBytes || !base64.test(data))
    return undefined
  return { type: "image", source: { type: "base64", media_type: screenshotType, data } }
}

function resultBlock(raw: unknown, screenshots: boolean): ResultBlock | undefined {
  const block = fieldsOf(raw)
  if (block?.type === "text" && named(block, ["type", "text"]))
    return typeof block.text === "string" && block.text.length > 0 ? { type: "text", text: block.text } : undefined
  return block?.type === "image" && screenshots ? imageBlock(block) : undefined
}

function resultContent(raw: unknown, screenshots: boolean): ToolAnswer["content"] | undefined {
  if (typeof raw === "string") return raw
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const blocks = raw.map((block) => resultBlock(block, screenshots))
  return blocks.every((block) => block !== undefined) ? blocks : undefined
}

function toolAnswer(raw: unknown, id: string, screenshots: boolean): ToolAnswer | undefined {
  const block = fieldsOf(raw)
  if (block?.type !== "tool_result" || !named(block, ["type", "tool_use_id", "content"], ["is_error"])) return undefined
  const content = resultContent(block.content, screenshots)
  if (block.tool_use_id !== id || content === undefined) return undefined
  if (block.is_error === undefined) return { type: "tool_result", tool_use_id: id, content }
  if (typeof block.is_error !== "boolean") return undefined
  return { type: "tool_result", tool_use_id: id, content, is_error: block.is_error }
}

function screenshotsOf(answer: ToolAnswer): readonly ImageBlock[] {
  return typeof answer.content === "string" ? [] : answer.content.filter((block) => block.type === "image")
}

export function screenshotsIn(messages: readonly ModelMessage[]): readonly ImageBlock[] {
  return messages.flatMap((message) =>
    message.role === "user" && Array.isArray(message.content)
      ? message.content.flatMap((block) => (block.type === "tool_result" ? screenshotsOf(block) : []))
      : [],
  )
}

export function sentWithoutScreenshots(message: ModelMessage): ModelMessage {
  if (message.role !== "user" || typeof message.content === "string") return message
  return {
    ...message,
    content: message.content.map((block) => (block.type === "tool_result" ? withoutScreenshots(block) : block)),
  }
}

export function withoutScreenshots(answer: ToolAnswer): ToolAnswer {
  if (screenshotsOf(answer).length === 0 || typeof answer.content === "string") return answer
  const content = answer.content.map((block): ResultBlock =>
    block.type === "image" ? { type: "text", text: screenshotLeftOut } : block,
  )
  return { ...answer, content }
}

function added(raw: unknown): TextBlock | undefined {
  const block = fieldsOf(raw)
  if (block?.type !== "text" || !named(block, ["type", "text"]) || !personText(block.text)) return undefined
  return { type: "text", text: block.text }
}

function asked(raw: unknown, calls: readonly string[], screenshots: boolean): ModelMessage | undefined {
  const message = fieldsOf(raw)
  if (message?.role !== "user" || !named(message, ["role", "content"])) return undefined
  const content = message.content
  if (calls.length === 0) return personText(content) ? { role: "user", content } : undefined
  if (!Array.isArray(content) || content.length < calls.length || content.length > calls.length + 1) return undefined
  const answers = calls.map((id, index) => toolAnswer(content[index], id, screenshots))
  const more = content.length > calls.length ? added(content[calls.length]) : null
  if (more === undefined || answers.some((answer) => answer === undefined)) return undefined
  const blocks = answers.filter((answer) => answer !== undefined)
  const shown = blocks.flatMap(screenshotsOf)
  const bytes = shown.reduce((total, { source }) => total + source.data.length, 0)
  if (shown.length > airaScreenshotCap || bytes > airaScreenshotBytes) return undefined
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
    const message = index % 2 === 0 ? asked(item, calls, index === list.length - 1) : replied(item)
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
