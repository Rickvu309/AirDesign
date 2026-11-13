import type { IncomingMessage, ServerResponse } from "node:http"

import { notifyKey, readDeckId, readNamedDeck } from "@airdesign/catalog"
import { openDeck, ownedDecks, type Deck } from "@airdesign/engine"
import {
  afterWrite,
  agentCaller,
  createServer,
  dropGoneTurn,
  editRefusal,
  emptyLog,
  type Host,
  type Lost,
  type Session,
  type ToolResult,
} from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"

import { storedTurns } from "./agent-turn.js"
import { admitCaller, refundCaller } from "./caller-log.js"
import { readOwnedDecks } from "./deck-list.js"
import type { Sql } from "./pool.js"
import { deckAccess, readSaved, readStoredOnce, uniqueOnce, writeRevision } from "./saved.js"

export type McpHost = {
  readonly deck: Sql
  readonly session: Sql
  readonly email: string
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
  const turns = storedTurns(host.session, host.email)
  const session: Session = {
    caller: agentCaller(host.mint()),
    deck: openDeck(pending.deck),
    log: emptyLog(),
    now: host.now(),
    turns,
  }
  let loaded: Deck = session.deck
  const bridge: Host = {
    admit: (called) => admitCaller(host.session, host.email, "tool", called.now),
    prepare: async (name, raw) => {
      if (name === "airdesign_list_decks") {
        try {
          session.owned = ownedDecks(await readOwnedDecks(host.deck, host.email), host.email)
        } catch {
          return { ok: false, refusal: "store" }
        }
        return { ok: true }
      }
      const named = readNamedDeck(raw)
      if (!named.ok) return named
      let saved: Awaited<ReturnType<typeof readSaved>>
      try {
        await turns.load(named.deck)
        saved = await readSaved(host.deck, named.deck)
      } catch {
        return { ok: false, refusal: "store" }
      }
      const seen = turns.read(named.deck)
      if (saved === undefined) return { ok: false, refusal: "deck" }
      const access = deckAccess(saved, host.email)
      if (!access.ok) return access
      loaded = { id: named.deck, revision: access.saved.revision, register: access.saved.register }
      session.deck = loaded
      dropGoneTurn(session, seen)
      if (session.once === undefined) return { ok: true }
      let prior: Awaited<ReturnType<typeof readStoredOnce>>
      try {
        prior = await readStoredOnce(host.deck, host.email, named.deck, session.once)
      } catch {
        return { ok: false, refusal: "store" }
      }
      return prior === undefined ? { ok: true } : { answered: storedAnswer(loaded, prior.answer) }
    },
    commit: (result) =>
      commitEdit(
        host.deck,
        loaded,
        result,
        session.once === undefined ? undefined : { email: host.email, once: session.once },
      ),
    refund: () => refundCaller(host.session, host.email, "tool"),
    turnSaved: () => turns.saved(),
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
    await turns.saved()
  }
}

const stopped = "The person stopped this call, and nothing landed."

function storedAnswer(loaded: Deck, stored: unknown): ToolResult {
  if (typeof stored !== "object" || stored === null || !("answer" in stored) || !("content" in stored))
    return editRefusal(loaded, "run-fenced", [], stopped)
  const { answer, content } = stored as Pick<Extract<ToolResult, { ok: true }>, "answer" | "content">
  return { ok: true, deck: loaded, content, ...(answer === undefined ? {} : { answer }) }
}

async function commitEdit(
  db: Sql,
  loaded: Deck,
  result: ToolResult,
  once: { readonly email: string; readonly once: string } | undefined,
): Promise<ToolResult | Lost> {
  if (!result.ok || result.deck === loaded) return result
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
      ...(once === undefined ? {} : { once: { ...once, answer: { content: result.content, answer: result.answer } } }),
    })
  } catch (error) {
    if (!uniqueOnce(error)) return editRefusal(loaded, "store", nodes)
  }
  if (wrote) return result
  let saved: Awaited<ReturnType<typeof readSaved>>
  try {
    saved = await readSaved(db, loaded.id)
  } catch {
    return editRefusal(loaded, "store", nodes)
  }
  if (saved === undefined) return editRefusal(loaded, "deck", [])
  if (saved.deleted) return editRefusal(loaded, "deleted", [])
  return { lost: afterWrite(false, result, { id: loaded.id, revision: saved.revision, register: saved.register }) }
}
