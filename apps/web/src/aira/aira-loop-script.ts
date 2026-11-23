import { airaRoutes, catalog, mcpRoutes, projectTools, type ReplyBlock } from "@airdesign/catalog"
import { askAira, type AiraChat } from "./aira-loop"

export const deck = "deck"
const nameOf = (op: string) => projectTools(catalog).find((tool) => tool.op === op)?.name ?? ""
export const edit = nameOf("edit_deck")
export const read = nameOf("read_deck")
export const stop = nameOf("stop_run")
export const usage = { used: 0.5, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }

type Turn =
  | { readonly lines: readonly unknown[]; readonly then?: "drop" | "hold" }
  | { readonly status: number; readonly body: unknown }

type Answer = {
  readonly structuredContent?: unknown
  readonly isError?: boolean
  readonly text?: string
  readonly content?: readonly unknown[]
}

type Sent = { readonly path: string; readonly body: Record<string, unknown> }

export function said(text: string) {
  return { type: "text", text }
}

export function call(id: string, name: string, input: Record<string, unknown>): ReplyBlock {
  return { type: "tool_use", id, name, input }
}

export function ended(content: readonly ReplyBlock[]) {
  const stop = content.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn"
  return { type: "end", ok: true, stop, content, usage }
}

function streamed(turn: Extract<Turn, { lines: unknown }>, signal: AbortSignal | null | undefined): ReadableStream {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of turn.lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
      if (turn.then === "drop") controller.error(new TypeError("network"))
      else if (turn.then === "hold") {
        signal?.addEventListener("abort", () => controller.error(new DOMException("stopped", "AbortError")))
      } else controller.close()
    },
  })
}

export function scripted(
  turns: readonly Turn[],
  answers: readonly Answer[],
  hooks: {
    onTool?: () => void
    onStop?: () => Promise<void>
    holdTools?: true
    stopped?: (body: Record<string, unknown>) => unknown
  } = {},
) {
  const queue = [...turns]
  const replies = [...answers]
  const sent: Sent[] = []
  const send: typeof fetch = async (input, init) => {
    const path = String(input)
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    sent.push({ path, body })
    if (path === airaRoutes.turn.path) {
      const turn = queue.shift()
      if (turn === undefined) throw new Error("no turn left")
      if ("status" in turn) return new Response(JSON.stringify(turn.body), { status: turn.status })
      return new Response(streamed(turn, init?.signal), { status: 200 })
    }
    if (path === airaRoutes.stop.path) {
      await hooks.onStop?.()
      return new Response(JSON.stringify(hooks.stopped?.(body) ?? { ok: true }))
    }
    if (path === mcpRoutes.mcp.path) {
      hooks.onTool?.()
      const params = body.params as { name: string; arguments: Record<string, unknown> }
      if (hooks.holdTools === true && params.name !== stop) {
        await new Promise<void>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")))
        })
      }
      const reply = params.name === stop ? { structuredContent: { ok: true } } : (replies.shift() ?? {})
      const text = reply.text ?? JSON.stringify(reply.structuredContent ?? {})
      const result = { content: [{ type: "text", text }], ...reply }
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result })}\n\n`)
    }
    throw new Error(path)
  }
  const turnsSent = () =>
    sent.filter((each) => each.path === airaRoutes.turn.path).map((each) => each.body.messages as readonly unknown[])
  const toolsSent = () =>
    sent.filter((each) => each.path === mcpRoutes.mcp.path).map((each) => (each.body.params as { name: string }).name)
  return { send, sent, turnsSent, toolsSent }
}

export async function asking(
  chat: AiraChat,
  text: string,
  link: ReturnType<typeof scripted>,
  more: { readonly stopOn?: (chat: AiraChat) => boolean; readonly added?: () => string | undefined } = {},
) {
  const stopping = new AbortController()
  const shown: AiraChat[] = []
  const done = await askAira(chat, text, {
    signal: stopping.signal,
    fetch: link.send,
    ...(more.added === undefined ? {} : { added: more.added }),
    show: (next) => {
      shown.push(next)
      if (more.stopOn?.(next) === true) stopping.abort()
    },
  })
  return { done, shown, stopping }
}

export const edited = { structuredContent: { ok: true, revision: 2, runId: "run-1" } }
export const editCall = call("call_1", edit, { deck, base: 1, changes: [] })
