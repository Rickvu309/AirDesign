import { airaTools, type ReplyBlock, type ToolCall } from "@airdesign/catalog"

export type Counts = {
  readonly input: number
  readonly output: number
  readonly write5m: number
  readonly write1h: number
  readonly read: number
}

export type Reported = { readonly input: number; readonly write5m: number; readonly read: number }

export type AiraEvent =
  | { readonly type: "text"; readonly text: string }
  | ({ readonly type: "tool" } & Omit<ToolCall, "type">)

export type Played =
  | {
      readonly kind: "settled"
      readonly stop: string
      readonly content: readonly ReplyBlock[]
      readonly counts: Counts
    }
  | { readonly kind: "released" }
  | { readonly kind: "dropped"; readonly started: Reported | null }

type Building =
  | { readonly type: "text"; text: string }
  | { readonly type: "thinking"; thinking: string; signature: string }
  | { readonly type: "redacted_thinking"; readonly data: string }
  | { readonly type: "tool_use"; readonly id: string; readonly name: string; json: string }

const toolNames: ReadonlySet<string> = new Set(airaTools.map((tool) => tool.name))

function fieldOf(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined
  return (value as Record<string, unknown>)[name]
}

function textOf(value: unknown, name: string): string | undefined {
  const field = fieldOf(value, name)
  return typeof field === "string" ? field : undefined
}

function countOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function unavailable(status: number, type: string, message: string): boolean {
  if (status === 429 || status === 529) return true
  if (type === "rate_limit_error" || type === "overloaded_error") return true
  return status === 400 && /usage limits/i.test(message)
}

function begin(block: unknown): Building | undefined {
  const type = fieldOf(block, "type")
  if (type === "text") return { type, text: textOf(block, "text") ?? "" }
  if (type === "thinking") {
    return { type, thinking: textOf(block, "thinking") ?? "", signature: textOf(block, "signature") ?? "" }
  }
  const data = textOf(block, "data")
  if (type === "redacted_thinking" && data !== undefined) return { type, data }
  const id = textOf(block, "id")
  const name = textOf(block, "name")
  if (type !== "tool_use" || id === undefined || name === undefined || !toolNames.has(name)) return undefined
  return { type, id, name, json: "" }
}

function grow(block: Building | undefined, delta: unknown): string | undefined {
  const kind = fieldOf(delta, "type")
  if (block?.type === "text" && kind === "text_delta") {
    const piece = textOf(delta, "text") ?? ""
    block.text += piece
    return piece
  }
  if (block?.type === "tool_use" && kind === "input_json_delta") block.json += textOf(delta, "partial_json") ?? ""
  if (block?.type === "thinking" && kind === "thinking_delta") block.thinking += textOf(delta, "thinking") ?? ""
  if (block?.type === "thinking" && kind === "signature_delta") block.signature += textOf(delta, "signature") ?? ""
  return undefined
}

function inputOf(json: string): Readonly<Record<string, unknown>> {
  try {
    const input: unknown = JSON.parse(json)
    if (typeof input === "object" && input !== null && !Array.isArray(input)) return input as Record<string, unknown>
  } catch {
    return {}
  }
  return {}
}

function finished(block: Building): ReplyBlock | undefined {
  if (block.type === "tool_use") return { type: "tool_use", id: block.id, name: block.name, input: inputOf(block.json) }
  if (block.type === "text") return block.text.length === 0 ? undefined : { type: "text", text: block.text }
  if (block.type === "thinking") return { type: "thinking", thinking: block.thinking, signature: block.signature }
  return { type: "redacted_thinking", data: block.data }
}

export async function* play(events: AsyncIterable<unknown>): AsyncGenerator<AiraEvent, Played> {
  const blocks = new Map<number, Building>()
  let started: unknown
  let final: unknown
  let stop = "end_turn"
  let begun = false
  try {
    for await (const event of events) {
      const type = fieldOf(event, "type")
      const index = countOf(fieldOf(event, "index")) ?? -1
      if (type === "message_start") {
        begun = true
        started = fieldOf(fieldOf(event, "message"), "usage")
      } else if (type === "content_block_start") {
        const block = begin(fieldOf(event, "content_block"))
        if (block !== undefined) blocks.set(index, block)
      } else if (type === "content_block_delta") {
        const piece = grow(blocks.get(index), fieldOf(event, "delta"))
        if (piece !== undefined && piece.length > 0) yield { type: "text", text: piece }
      } else if (type === "content_block_stop") {
        const block = blocks.get(index)
        if (block?.type === "tool_use")
          yield { type: "tool", id: block.id, name: block.name, input: inputOf(block.json) }
      } else if (type === "message_delta") {
        final = fieldOf(event, "usage")
        stop = textOf(fieldOf(event, "delta"), "stop_reason") ?? stop
      } else if (type === "error") {
        const error = fieldOf(event, "error")
        if (
          !begun &&
          final === undefined &&
          unavailable(0, textOf(error, "type") ?? "", textOf(error, "message") ?? "")
        ) {
          return { kind: "released" }
        }
        break
      }
    }
  } catch {}
  const pick = (name: string): number => countOf(fieldOf(final, name)) ?? countOf(fieldOf(started, name)) ?? 0
  if (final === undefined) {
    if (!begun) return { kind: "dropped", started: null }
    return {
      kind: "dropped",
      started: {
        input: pick("input_tokens"),
        write5m: pick("cache_creation_input_tokens"),
        read: pick("cache_read_input_tokens"),
      },
    }
  }
  const content = [...blocks.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, block]) => finished(block) ?? [])
  return {
    kind: "settled",
    stop,
    content,
    counts: {
      input: pick("input_tokens"),
      output: pick("output_tokens"),
      write5m: pick("cache_creation_input_tokens"),
      write1h: 0,
      read: pick("cache_read_input_tokens"),
    },
  }
}
