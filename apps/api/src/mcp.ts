import type { IncomingMessage, ServerResponse } from "node:http"

import { notifyKey, readDeckId, readNamedDeck } from "@airdesign/catalog"
import { openDeck, type Deck } from "@airdesign/engine"
import {
  afterWrite,
  agentCaller,
  createServer,
  editRefusal,
  emptyLog,
  type CallerLog,
  type Host,
  type Session,
  type ToolResult,
} from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"

import type { Sql } from "./pool.js"
import { readSaved, writeRevision } from "./saved.js"

export type McpHost = {
  readonly deck: Sql
  readonly email: string
  readonly logs: Map<string, CallerLog>
  readonly now: () => number
  readonly mint: () => string
  readonly hosts: readonly string[]
  readonly bodyCap: number
  readonly fail: (error: unknown) => void
}

function mcpRequest(req: IncomingMessage, body: Buffer) {
  return {
    headers: req.headers,
    ...(typeof req.method === "string" ? { method: req.method } : {}),
    ...(typeof req.url === "string" ? { url: req.url } : {}),
    async *[Symbol.asyncIterator]() {
      if (body.length > 0) yield body
    },
  }
}

export async function serveMcp(host: McpHost, req: IncomingMessage, res: ServerResponse, body: Buffer): Promise<void> {
  const names = [...host.hosts]
  if (!hostHeaderValidation(names)(req, res) || !originValidation(names)(req, res)) return
  const pending = readDeckId("pending")
  if (!pending.ok) throw new Error(pending.refusal)
  if (!host.logs.has(host.email)) host.logs.set(host.email, emptyLog())
  const session: Session = {
    caller: agentCaller(host.mint()),
    deck: openDeck(pending.deck),
    get log() {
      return host.logs.get(host.email) ?? emptyLog()
    },
    set log(value) {
      host.logs.set(host.email, value)
    },
    now: host.now(),
  }
  let loaded: Deck = session.deck
  const bridge: Host = {
    prepare: async (_name, raw) => {
      const named = readNamedDeck(raw)
      if (!named.ok) return named
      let saved: Awaited<ReturnType<typeof readSaved>>
      try {
        saved = await readSaved(host.deck, named.deck)
      } catch {
        return { ok: false, refusal: "store" }
      }
      if (saved === undefined) return { ok: false, refusal: "deck" }
      if (saved.owner !== host.email) return { ok: false, refusal: "owner" }
      loaded = { id: named.deck, revision: saved.revision, register: saved.register }
      session.deck = loaded
      return { ok: true }
    },
    commit: (result) => commitEdit(host.deck, loaded, result),
  }
  const handler = createMcpHandler(() => createServer(session, bridge), { maxRequestBodySize: host.bodyCap })
  let failed = false
  const onerror = (error: Error): void => {
    failed = true
    host.fail(error)
  }
  try {
    await toNodeHandler(handler, { maxRequestBodySize: host.bodyCap, onerror })(mcpRequest(req, body), res)
  } catch (error) {
    if (!failed) throw error
  } finally {
    await handler.close()
  }
}

async function commitEdit(db: Sql, loaded: Deck, result: ToolResult): Promise<ToolResult> {
  if (!result.ok) return result
  const nodes = (result.answer?.elements ?? []).map((element) => element.node)
  const key = notifyKey(result.deck.id, result.deck.revision)
  if (!key.ok) return editRefusal(loaded, "payload", nodes)
  let wrote = false
  try {
    wrote = await writeRevision(db, {
      id: result.deck.id,
      revision: result.deck.revision,
      register: result.deck.register,
      expected: loaded.revision,
      key: key.key,
    })
  } catch {
    return editRefusal(loaded, "store", nodes)
  }
  if (wrote) return result
  let saved: Awaited<ReturnType<typeof readSaved>>
  try {
    saved = await readSaved(db, loaded.id)
  } catch {
    return editRefusal(loaded, "store", nodes)
  }
  if (saved === undefined) return editRefusal(loaded, "deck", [])
  return afterWrite(false, result, { id: loaded.id, revision: saved.revision, register: saved.register })
}
