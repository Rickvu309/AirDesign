import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

import { notifyKey, readDeckId, type DeckId } from "@airdesign/catalog"
import { openDeck, type Deck } from "@airdesign/engine"
import {
  afterWrite,
  createServer,
  emptyLog,
  type CallerLog,
  type Host,
  type Session,
  type ToolResult,
} from "@airdesign/mcp"
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"

import type { Sql } from "./pool.js"
import { readSaved, writeRevision } from "./saved.js"

const validateHost = localhostHostValidation()
const validateOrigin = localhostOriginValidation()

export type McpHost = {
  readonly deck: Sql
  readonly email: string
  readonly logs: Map<string, CallerLog>
  readonly now: () => number
}

function namedDeck(
  raw: unknown,
): { readonly ok: true; readonly deck: DeckId } | { readonly ok: false; readonly refusal: "field" | "deck" } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, refusal: "field" }
  const body = raw as Record<string, unknown>
  if (!Object.hasOwn(body, "deck")) return { ok: false, refusal: "field" }
  const parsed = readDeckId(body.deck)
  if (!parsed.ok) return { ok: false, refusal: "deck" }
  return { ok: true, deck: parsed.deck }
}

function refused(deck: Deck, refusal: string): ToolResult {
  return { ok: false, refusal, deck, content: [{ type: "text", text: refusal }] }
}

function mcpRequest(req: IncomingMessage) {
  return {
    headers: req.headers,
    ...(typeof req.method === "string" ? { method: req.method } : {}),
    ...(typeof req.url === "string" ? { url: req.url } : {}),
    [Symbol.asyncIterator]() {
      return req[Symbol.asyncIterator]()
    },
  }
}

export async function serveMcp(host: McpHost, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!validateHost(req, res) || !validateOrigin(req, res)) return
  const pending = readDeckId("pending")
  if (!pending.ok) throw new Error(pending.refusal)
  const found = host.logs.get(host.email)
  const log = found ?? emptyLog()
  if (found === undefined) host.logs.set(host.email, log)
  const caller = { actor: "agent" as const, runId: randomUUID(), readAt: 0 }
  const session: Session = { caller, deck: openDeck(pending.deck), log, now: host.now() }
  let loaded: Deck = session.deck
  const bridge: Host = {
    prepare: async (_name, raw) => {
      const named = namedDeck(raw)
      if (!named.ok) return named
      const saved = await readSaved(host.deck, named.deck)
      if (saved === undefined) return { ok: false, refusal: "deck" }
      if (saved.owner !== host.email) return { ok: false, refusal: "owner" }
      loaded = { id: named.deck, revision: saved.revision, register: saved.register }
      session.deck = loaded
      return { ok: true }
    },
    commit: (result) => commitEdit(host.deck, loaded, result),
  }
  const handler = createMcpHandler(() => createServer(session, bridge), { responseMode: "json" })
  try {
    await toNodeHandler(handler)(mcpRequest(req), res)
  } finally {
    host.logs.set(host.email, session.log)
    await handler.close()
  }
}

async function commitEdit(db: Sql, loaded: Deck, result: ToolResult): Promise<ToolResult> {
  if (!result.ok) return result
  const key = notifyKey(result.deck.id, result.deck.revision)
  if (!key.ok) return refused(loaded, "payload")
  const wrote = await writeRevision(db, {
    id: result.deck.id,
    revision: result.deck.revision,
    register: result.deck.register,
    expected: loaded.revision,
    key: key.key,
  })
  return afterWrite(wrote, result, loaded)
}
