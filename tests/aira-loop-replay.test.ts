import path from "node:path"
import { fileURLToPath } from "node:url"
import { airaRoutes, catalog, mcpRoutes, onceMeta, projectTools } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { airaChat, askAira, retryAira, type AiraChat } from "@/aira-loop"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/aira-loop/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const deck = "deck"
const run = "r"
const nameOf = (op: string) => projectTools(catalog).find((tool) => tool.op === op)?.name ?? ""
const edit = nameOf("edit_deck")
const stopRun = nameOf("stop_run")
const usage = { used: 0.5, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }

function ended(content: readonly unknown[]): string {
  const stop = content.some((block) => (block as { type: string }).type === "tool_use") ? "tool_use" : "end_turn"
  return `${JSON.stringify({ type: "end", ok: true, stop, content, usage })}\n`
}

function mcpAnswer(id: unknown, structured: unknown): Response {
  const result = { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured }
  return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`)
}

function later<T>() {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0)).then(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

function stopped(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), { once: true })
  })
}

function answeredOnce(messages: readonly unknown[]): void {
  const last = messages.at(-1) as { role: string; content: unknown }
  const blocks = Array.isArray(last.content) ? (last.content as readonly { type: string; tool_use_id?: string }[]) : []
  if (last.role !== "user" || blocks.length !== 1 || blocks[0]?.tool_use_id !== "call_1") {
    throw new Error(`a retry sent ${JSON.stringify(last)}`)
  }
}

function hasRun(chat: AiraChat | undefined): boolean {
  return chat?.exchanges[0]?.runs.includes(run) === true
}

function loop() {
  const read = later<void>()
  const finish = later<"done" | "failed">()
  const spend = later<void>()
  const close = later<void>()
  const stopping = new AbortController()
  const seen = {
    server: "none" as "none" | "landed" | "spent",
    once: "",
    named: false,
    cut: false,
    answered: false,
    stopRunSent: false,
    closed: false,
    settled: false,
    asked: false,
    held: false,
    sent: false,
    retried: false,
    first: undefined as AiraChat | undefined,
    next: undefined as AiraChat | undefined,
  }
  const send: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    const where = String(input)
    if (where === airaRoutes.stop.path) {
      if (body.call === undefined) return new Response(JSON.stringify({ ok: true }))
      if (JSON.stringify(body.call) !== JSON.stringify({ deck, once: seen.once })) {
        throw new Error(`stop names ${JSON.stringify(body.call)}`)
      }
      await spend.promise
      seen.named = true
      if (seen.server === "landed") return new Response(JSON.stringify({ ok: true, runId: run }))
      seen.server = "spent"
      return new Response(JSON.stringify({ ok: true }))
    }
    if (where === airaRoutes.turn.path) {
      const messages = body.messages as readonly unknown[]
      if (body.ask === "ask-2") {
        if (seen.retried) answeredOnce(messages)
        seen.sent = true
        return new Response(ended([{ type: "text", text: "Ok" }]))
      }
      if (messages.length === 1) {
        return new Response(ended([{ type: "tool_use", id: "call_1", name: edit, input: { deck, base: 1 } }]))
      }
      const how = await Promise.race([finish.promise, stopped(init?.signal)])
      if (how === "failed") return new Response(`${JSON.stringify({ type: "end", ok: false, usage })}\n`)
      return new Response(ended([{ type: "text", text: "Done" }]))
    }
    if (where === mcpRoutes.mcp.path) {
      const params = body.params as {
        name: string
        arguments: Record<string, unknown>
        _meta?: Record<string, unknown>
      }
      if (params.name === stopRun) {
        if (params.arguments.runId !== run) throw new Error(`stop_run of ${String(params.arguments.runId)}`)
        seen.stopRunSent = true
        await close.promise
        seen.closed = true
        return mcpAnswer(body.id, { ok: true })
      }
      seen.once = String(params._meta?.[onceMeta])
      init?.signal?.addEventListener(
        "abort",
        () => {
          if (!seen.answered) seen.cut = true
        },
        { once: true },
      )
      await Promise.race([read.promise, stopped(init?.signal)])
      seen.answered = true
      return mcpAnswer(body.id, { ok: true, revision: 2, runId: run })
    }
    throw new Error(where)
  }
  let mint = 0
  const first = askAira(airaChat(deck), "Retitle", {
    signal: stopping.signal,
    fetch: send,
    mint: () => `ask-${String((mint += 1))}`,
    show: (chat) => {
      seen.first = chat
    },
  })
  void first.then(() => {
    seen.settled = true
  })
  let next: Promise<AiraChat> | undefined
  const act = async (action: string): Promise<string | null> => {
    if (action === "Land") {
      if (seen.server !== "none") return `Land on a once already ${seen.server}`
      seen.server = "landed"
    } else if (action === "Read") {
      if (seen.cut) return "Read after the browser cut the call"
      read.settle()
    } else if (action === "Stop") stopping.abort()
    else if (action === "Spend") spend.settle()
    else if (action === "Finish") finish.settle("done")
    else if (action === "Fail") finish.settle("failed")
    else if (action === "Close") {
      if (!seen.stopRunSent) return "Close with no stop_run of r sent"
      close.settle()
    } else if (action === "Ask" || action === "Retry") {
      seen.asked = true
      seen.retried = action === "Retry"
      seen.held = hasRun(seen.first)
      const options = {
        signal: new AbortController().signal,
        fetch: send,
        mint: () => "ask-2",
        show: (chat: AiraChat) => {
          seen.next = chat
        },
        after: first,
      }
      next = seen.retried
        ? retryAira(seen.first ?? airaChat(deck), options)
        : askAira(seen.first ?? airaChat(deck), "Again", options)
    } else if (action !== "Done") return `no step for ${action}`
    await flush()
    return null
  }
  const picture = (): Spec => ({
    server: seen.server,
    answer: seen.cut ? "cut" : seen.answered ? "read" : "waiting",
    named: seen.named,
    stop: stopping.signal.aborted,
    shown: seen.first?.exchanges[0]?.end ?? "none",
    known: hasRun(seen.first),
    closed: seen.closed,
    settled: seen.settled,
    asked: seen.asked,
    held: seen.held,
    sent: seen.sent,
    nextKnown: seen.sent && hasRun(seen.next),
    retried: seen.retried,
    rows: seen.asked ? (seen.next?.exchanges.length ?? 0) : 1,
  })
  const finished = async () => {
    finish.settle("done")
    stopping.abort()
    read.settle()
    spend.settle()
    close.settle()
    await Promise.allSettled([first, next])
  }
  return { act, picture, finished, ready: flush }
}

function pathsTo(graph: Graph): Map<string, readonly Edge[]> {
  const start = [...graph.states].find(([, state]) => state.shown === "working" && state.server === "none")?.[0]
  if (start === undefined) throw new Error("no start state")
  const paths = new Map<string, readonly Edge[]>([[start, []]])
  const order = [start]
  for (let at = 0; at < order.length; at += 1) {
    const from = order[at] ?? ""
    for (const edge of graph.edges) {
      if (edge.from !== from || paths.has(edge.to)) continue
      paths.set(edge.to, [...(paths.get(from) ?? []), edge])
      order.push(edge.to)
    }
  }
  return paths
}

function differing(actual: Spec, expected: Spec | undefined): readonly string[] {
  if (expected === undefined) return ["no model state"]
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)])
  return [...keys].filter((key) => actual[key] !== expected[key])
}

function words(state: Spec | undefined): string {
  return state === undefined ? "unknown" : `${view.group(state)}: ${view.state(state)}`
}

describe("aira-loop replay", () => {
  it("drives every edge of the model through askAira", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "aira-loop")
    if (spec === undefined) throw new Error("no aira-loop spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const paths = pathsTo(graph)
    const failures: string[] = []
    let replayed = 0
    for (const edge of graph.edges) {
      const before = paths.get(edge.from)
      if (before === undefined) throw new Error(`no path to ${edge.from}`)
      const driven = loop()
      await driven.ready()
      const start = paths.get(edge.from)?.[0]?.from ?? edge.from
      if (differing(driven.picture(), graph.states.get(start)).length > 0) {
        failures.push(`start differs: ${JSON.stringify(driven.picture())}`)
      }
      for (const step of [...before, edge]) {
        const refused = await driven.act(step.action)
        const expected = graph.states.get(step.to)
        const actual = driven.picture()
        const where = `${words(graph.states.get(step.from))} -${step.action}-> ${words(expected)}`
        if (refused !== null) failures.push(`${where}\n  ${refused}`)
        else if (differing(actual, expected).length > 0) {
          failures.push(`${where}\n  differs in ${differing(actual, expected).join(", ")}: ${JSON.stringify(actual)}`)
        }
        if (refused !== null || failures.length > 0) break
      }
      await driven.finished()
      if (failures.length > 0) break
      replayed += 1
    }
    expect(failures).toEqual([])
    expect(replayed).toBe(graph.edges.length)
    expect(new Set(graph.edges.map((edge) => edge.action))).toEqual(
      new Set(["Land", "Read", "Stop", "Spend", "Finish", "Fail", "Close", "Ask", "Retry", "Done"]),
    )
  }, 60_000)
})
