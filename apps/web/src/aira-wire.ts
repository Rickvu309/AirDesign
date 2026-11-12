import type { ReplyBlock } from "@airdesign/catalog"

export type WeekUsage = { readonly used: number; readonly allowed: number; readonly resets: string }

export type AiraLine =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "tool"; readonly id: string; readonly name: string }
  | {
      readonly type: "end"
      readonly ok: true
      readonly stop: string
      readonly content: readonly ReplyBlock[]
      readonly usage: WeekUsage
    }
  | { readonly type: "end"; readonly ok: false; readonly refusal: string; readonly usage: WeekUsage }

export type ToolOutcome = {
  readonly ok: boolean
  readonly text: string
  readonly fields: Readonly<Record<string, unknown>> | undefined
}

export function fieldsOf(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function weekUsage(raw: unknown): WeekUsage | undefined {
  const usage = fieldsOf(raw)
  if (usage === undefined) return undefined
  const { used, allowed, resets } = usage
  if (typeof used !== "number" || typeof allowed !== "number" || typeof resets !== "string") return undefined
  return { used, allowed, resets }
}

function replyBlocks(raw: unknown): readonly ReplyBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const blocks: ReplyBlock[] = []
  for (const item of raw) {
    const block = fieldsOf(item)
    if (typeof block?.type !== "string") return undefined
    blocks.push(item as ReplyBlock)
  }
  return blocks
}

export function airaLine(text: string): AiraLine | undefined {
  const line = fieldsOf(parsed(text))
  if (line?.type === "text") return typeof line.text === "string" ? { type: "text", text: line.text } : undefined
  if (line?.type === "tool") {
    if (typeof line.id !== "string" || typeof line.name !== "string") return undefined
    return { type: "tool", id: line.id, name: line.name }
  }
  if (line?.type !== "end") return undefined
  const usage = weekUsage(line.usage)
  if (usage === undefined) return undefined
  const content = replyBlocks(line.content)
  if (line.ok === true && typeof line.stop === "string" && content !== undefined) {
    return { type: "end", ok: true, stop: line.stop, content, usage }
  }
  if (line.ok === false && typeof line.refusal === "string")
    return { type: "end", ok: false, refusal: line.refusal, usage }
  return undefined
}

export async function* bodyLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let kept = ""
  try {
    for (;;) {
      const read = await reader.read()
      kept += decoder.decode(read.value, { stream: !read.done })
      const lines = kept.split("\n")
      kept = lines.pop() ?? ""
      for (const line of lines) if (line.trim() !== "") yield line
      if (read.done) break
    }
    if (kept.trim() !== "") yield kept
  } finally {
    reader.releaseLock()
  }
}

function answerText(content: unknown): string {
  if (!Array.isArray(content)) return ""
  return content
    .map((block) => fieldsOf(block)?.text)
    .filter((text) => typeof text === "string")
    .join("\n")
}

export function toolOutcome(body: string): ToolOutcome {
  const messages = body.trimStart().startsWith("{")
    ? [body]
    : body
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length))
  for (const message of messages) {
    const answer = fieldsOf(parsed(message))
    const result = fieldsOf(answer?.result)
    if (result !== undefined) {
      const fields = fieldsOf(result.structuredContent)
      const text = answerText(result.content)
      return {
        ok: result.isError !== true && fields?.ok !== false,
        text: text === "" ? JSON.stringify(fields ?? {}) : text,
        fields,
      }
    }
    const error = fieldsOf(answer?.error)
    if (error !== undefined) {
      return {
        ok: false,
        text: typeof error.message === "string" ? error.message : JSON.stringify(error),
        fields: undefined,
      }
    }
  }
  return { ok: false, text: body === "" ? "The tool answered with nothing." : body, fields: undefined }
}
