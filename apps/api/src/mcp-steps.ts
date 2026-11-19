import { randomBytes } from "node:crypto"
import type { createServer, IncomingMessage, Server } from "node:http"
import type { AddressInfo } from "node:net"

import { onceMeta, readDeckId, readDeckIndex, type AgentOp, type DeckId } from "@airdesign/catalog"
import { elementId, foldSlides, readSlideId, type Register } from "@airdesign/document"

import { indexSaved } from "./index-saved.js"
import { serveMcp, type Measures } from "./mcp.js"
import type { Sql } from "./pool.js"
import { openSaved } from "./saved.js"

export const stepNode = elementId("256.2")

export type Stores = { readonly deck: Sql; readonly session: Sql }

export type Owned = {
  readonly stores: Stores
  readonly deck: DeckId
  readonly email: string
  readonly agentKey?: string
  readonly measures?: Measures
}

export type Gate = "turn" | "deck" | "write" | "save"

export type Reply = { readonly ok: boolean; readonly body: Record<string, unknown> | undefined }

export type Call = {
  at: Gate | "end"
  tries: number
  read: number | undefined
  reply: Reply | undefined
  readonly release: () => Promise<void>
}

type Running = Call & { last: Gate | undefined; go: () => void; arrived: () => void; ended: Promise<void> }

const accept = "application/json, text/event-stream"

function gateOf(text: string): Gate | undefined {
  if (text.includes("from session.agent_turn where email")) return "turn"
  if (text.includes("from deck.saved where id")) return "deck"
  if (text.includes("update deck.saved")) return "write"
  if (text.includes("insert into session.agent_turn")) return "save"
  return undefined
}

function gated(db: Sql, call: Running): Sql {
  return new Proxy(db, {
    get(target, key) {
      const member = Reflect.get(target, key) as unknown
      if (key !== "query" || typeof member !== "function")
        return typeof member === "function" ? member.bind(target) : member
      const query = member as (...args: unknown[]) => Promise<{ rows: { revision?: number }[] }>
      return async (...args: unknown[]) => {
        const gate = typeof args[0] === "string" ? gateOf(args[0]) : undefined
        if (gate === undefined || (gate === "deck" && call.last === "write")) return query.apply(target, args)
        call.last = gate
        await new Promise<void>((resolve) => {
          call.at = gate
          call.go = resolve
          call.arrived()
        })
        const result = await query.apply(target, args)
        if (gate === "turn") call.tries += 1
        if (gate === "deck") call.read = result.rows[0]?.revision
        return result
      }
    },
  }) as Sql
}

function bodyOf(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function replyOf(text: string): Reply {
  const lines = text.startsWith("{")
    ? [text]
    : text.split("\n").flatMap((line) => (line.startsWith("data: ") ? [line.slice(6)] : []))
  for (const line of lines) {
    const message = JSON.parse(line) as {
      result?: { isError?: boolean; structuredContent?: Record<string, unknown> }
    }
    if (message.result !== undefined)
      return { ok: message.result.isError !== true, body: message.result.structuredContent }
  }
  throw new Error(`no result in ${text}`)
}

function ended(call: Call): boolean {
  return call.at === "end"
}

function waitFor(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve = () => undefined as void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export type McpSteps = {
  readonly start: (
    owned: Owned,
    runId: string,
    op: AgentOp,
    args: Record<string, unknown>,
    once?: string,
  ) => Promise<Call>
  readonly close: () => Promise<void>
}

export async function mcpSteps(open: typeof createServer): Promise<McpSteps> {
  const waiting = new Map<string, { readonly owned: Owned; readonly runId: string; readonly call: Running }>()
  const server: Server = open((req, res) => {
    const id = String(req.headers["x-call"])
    const found = waiting.get(id)
    if (found === undefined) {
      res.writeHead(404).end()
      return
    }
    waiting.delete(id)
    const { owned, runId, call } = found
    void bodyOf(req).then((body) =>
      serveMcp(
        {
          deck: gated(owned.stores.deck, call),
          session: gated(owned.stores.session, call),
          email: owned.email,
          agentKey: owned.agentKey ?? "",
          now: () => 1_000_000,
          mint: () => runId,
          hosts: ["127.0.0.1"],
          bodyCap: 1_000_000,
          fail: (error) => {
            res.writeHead(500).end(String(error))
          },
          ...(owned.measures === undefined ? {} : { measures: owned.measures }),
        },
        req,
        res,
        body,
      ).finally(() => {
        call.at = "end"
        call.arrived()
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  const start = async (
    owned: Owned,
    runId: string,
    op: AgentOp,
    args: Record<string, unknown>,
    once?: string,
  ): Promise<Call> => {
    const id = randomBytes(8).toString("hex")
    let arrival = waitFor()
    const call: Running = {
      at: "turn",
      tries: 0,
      read: undefined,
      reply: undefined,
      last: undefined,
      go: () => undefined,
      arrived: () => arrival.resolve(),
      ended: Promise.resolve(),
      release: async () => {
        if (ended(call)) throw new Error("ended")
        arrival = waitFor()
        call.go()
        await arrival.promise
        if (ended(call)) await call.ended
      },
    }
    waiting.set(id, { owned, runId, call })
    call.ended = fetch(`http://127.0.0.1:${String(port)}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept, "x-call": id },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: `airdesign_${op}`,
          arguments: args,
          ...(once === undefined ? {} : { _meta: { [onceMeta]: once } }),
        },
      }),
    })
      .then((answer) => answer.text())
      .then((text) => {
        call.reply = replyOf(text)
      })
      .catch(() => undefined)
    await arrival.promise
    if (ended(call)) await call.ended
    return call
  }
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  return { start, close }
}

export async function finish(call: Call): Promise<Reply> {
  while (!ended(call)) await call.release()
  if (call.reply === undefined) throw new Error("reply")
  return call.reply
}

export async function wholeCall(
  steps: McpSteps,
  owned: Owned,
  runId: string,
  op: AgentOp,
  args: Record<string, unknown>,
  once?: string,
): Promise<Reply> {
  return finish(await steps.start(owned, runId, op, args, once))
}

export function revisionOf(reply: Reply): number {
  const revision = reply.body?.revision
  if (!reply.ok || typeof revision !== "number") throw new Error(`no revision in ${JSON.stringify(reply)}`)
  return revision
}

export async function indexedDeck(stores: Stores, name: string): Promise<Owned & { readonly revision: number }> {
  const parsed = readDeckId(`${name}-${randomBytes(6).toString("hex")}`)
  if (!parsed.ok) throw new Error(parsed.refusal)
  const email = `${name}-${randomBytes(6).toString("hex")}@example.com`
  await stores.session.query("insert into session.account (email) values ($1)", [email])
  const made = await openSaved(stores.deck, parsed, email)
  if (!made.ok) throw new Error(made.refusal)
  const page = readDeckIndex({
    deck: parsed.deck,
    once: "index",
    offset: 0,
    total: 1,
    slides: [
      { id: "256", position: 0, layout: [] },
      { id: "257", position: 1, layout: [] },
    ],
    elements: [{ node: stepNode, kind: "shape", value: "Title", box: null, grouped: false }],
  })
  if (!page.ok) throw new Error(page.refusal)
  const indexed = await indexSaved(stores.deck, page, email)
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { stores, deck: parsed.deck, email, revision: indexed.revision }
}

export async function turnRow(owned: Owned) {
  const found = await owned.stores.session.query<{ run_id: string | null; revision: number }>(
    "select run_id, revision from session.agent_turn where email = $1 and deck = $2",
    [owned.email, owned.deck],
  )
  return found.rows[0]
}

export async function toolCalls(owned: Owned): Promise<number> {
  const found = await owned.stores.session.query<{ events: { kind: string }[] }>(
    "select events from session.caller_log where email = $1",
    [owned.email],
  )
  return (found.rows[0]?.events ?? []).filter((event) => event.kind === "tool").length
}

export function slidesAddedBy(register: Register, runId: string): readonly string[] {
  const added = new Set(register.order.flatMap((row) => (row.runId === runId && row.slide === "add" ? [row.id] : [])))
  const file =
    register.file.length > 0 ? register.file : (register.index?.slides.flatMap(({ id }) => readSlideId(id) ?? []) ?? [])
  return foldSlides({ ...register, file })
    .filter((slide) => slide.present && added.has(slide.id))
    .map((slide) => slide.id)
}
