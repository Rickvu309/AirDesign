import type { IncomingMessage, ServerResponse } from "node:http"

import { notifyKey, readDeckId, readNamedDeck, type DeckId, type FindingsReport } from "@airdesign/catalog"
import { measureOwed, readSlideId } from "@airdesign/document"
import { openDeck, ownedDecks, type Deck } from "@airdesign/engine"
import {
  afterWrite,
  agentCaller,
  createServer,
  dropGoneTurn,
  editRefusal,
  emptyLog,
  imageAddresses,
  imagesPerCall,
  type NamedImage,
  type Host,
  type ReadPictures,
  type Lost,
  type Session,
  type ToolResult,
} from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"

import { storedTurns } from "./agent-turn.js"
import { fetchImage, type ImageNet } from "./image-fetch.js"
import { keepMedia } from "./media.js"
import type { OriginalStore } from "./original-store.js"
import { admitCaller, refundCaller } from "./caller-log.js"
import { readOwnedDecks } from "./deck-list.js"
import type { DeckFindings } from "./deck-findings.js"
import type { DeckPictures } from "./deck-pictures.js"
import { readPictures } from "./read-pictures.js"
import type { DeckListen } from "./listen.js"
import type { Sql } from "./pool.js"
import { deckAccess, readSaved, readStoredOnce, uniqueOnce, writeRevision } from "./saved.js"

export type McpHost = {
  readonly deck: Sql
  readonly session: Sql
  readonly email: string
  readonly agentKey: string
  readonly now: () => number
  readonly mint: () => string
  readonly hosts: readonly string[]
  readonly bodyCap: number
  readonly fail: (error: unknown) => void
  readonly measures?: Measures
  readonly images?: { readonly store: OriginalStore | undefined; readonly net: ImageNet }
}

export type Measures = {
  readonly listen: Pick<DeckListen, "wait" | "ready">
  readonly following: (deck: string) => boolean
  readonly limit: number
  readonly findings?: Pick<DeckFindings, "latest" | "wait">
  readonly pictures?: Pick<DeckPictures, "shot" | "wait">
}

type Saved = Awaited<ReturnType<typeof readSaved>>

function owes(saved: Saved): boolean {
  return saved !== undefined && saved.register !== null && measureOwed(saved.register).length > 0
}

async function measuredSaved(db: Sql, deck: string, measures: Measures | undefined): Promise<Saved> {
  const first = await readSaved(db, deck)
  if (measures === undefined || !owes(first) || !measures.following(deck)) return first
  const until = AbortSignal.timeout(measures.limit)
  let saved = first
  while (owes(saved) && !until.aborted) {
    const woken = measures.listen.wait(until)
    await measures.listen.ready()
    saved = await readSaved(db, deck)
    if (owes(saved)) await woken
  }
  return owes(saved) ? await readSaved(db, deck) : saved
}

async function namedImage(host: McpHost, deck: DeckId, address: string): Promise<NamedImage> {
  if (host.images === undefined) return { ok: false, refusal: "unreachable" }
  const fetched = await fetchImage(address, host.images.net)
  if (!fetched.ok) return fetched
  try {
    const kept = await keepMedia(host.deck, deck, fetched.bytes, host.email, host.images.store)
    if (!kept.ok) return { ok: false, refusal: kept.refusal === "limit" ? "full" : "store" }
    const media = { sha256: kept.sha256, type: fetched.type }
    return { ok: true, media, width: fetched.width, height: fetched.height }
  } catch {
    return { ok: false, refusal: "store" }
  }
}

async function fetchedImages(host: McpHost, session: Session, deck: DeckId, raw: unknown): Promise<void> {
  const named = new Map(session.images ?? [])
  const wanted = imageAddresses(raw).filter((address) => !named.has(address))
  const fetched = await Promise.all(
    wanted.slice(0, imagesPerCall).map(async (address) => [address, await namedImage(host, deck, address)] as const),
  )
  for (const [address, image] of fetched) named.set(address, image)
  for (const address of wanted.slice(imagesPerCall)) named.set(address, { ok: false, refusal: "many" })
  session.images = named
}

async function freshFindings(
  measures: Measures | undefined,
  deck: DeckId,
  revision: number,
): Promise<FindingsReport | undefined> {
  const findings = measures?.findings
  if (measures === undefined || findings === undefined) return undefined
  const behind = () => (findings.latest(deck)?.revision ?? revision) < revision
  if (!behind() || !measures.following(deck)) return findings.latest(deck)
  const until = AbortSignal.timeout(measures.limit)
  while (behind() && !until.aborted) await findings.wait(deck, until)
  return findings.latest(deck)
}

function argsOf(raw: unknown): Readonly<Record<string, unknown>> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function picturesAsked(name: string, raw: unknown): boolean {
  return name === "airdesign_read_deck" && argsOf(raw).picture === true
}

async function shownPictures(measures: Measures | undefined, deck: Deck, raw: unknown): Promise<ReadPictures> {
  const pictures = measures?.pictures
  const watch = measures === undefined || pictures === undefined ? undefined : { ...measures, pictures }
  return readPictures(watch, deck, readSlideId(argsOf(raw).slide))
}

async function savedAt(db: Sql, deck: DeckId, email: string, revision: number): Promise<Deck | undefined> {
  const saved = await readSaved(db, deck).catch(() => undefined)
  const access = saved === undefined ? undefined : deckAccess(saved, email)
  if (access?.ok !== true || access.saved.revision !== revision) return undefined
  return { id: deck, revision, register: access.saved.register }
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
  const turns = storedTurns(host.session, host.email, host.agentKey)
  const session: Session = {
    caller: agentCaller(host.mint()),
    deck: openDeck(pending.deck),
    log: emptyLog(),
    now: host.now(),
    turns,
  }
  let loaded: Deck = session.deck
  let storedIndex: unknown = null
  const bridge: Host = {
    admit: (called) => admitCaller(host.session, host.email, "tool", called.now, host.agentKey),
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
        saved = await measuredSaved(host.deck, named.deck, host.measures)
      } catch {
        return { ok: false, refusal: "store" }
      }
      const seen = turns.read(named.deck)
      if (saved === undefined) return { ok: false, refusal: "deck" }
      const access = deckAccess(saved, host.email)
      if (!access.ok) {
        const { refusal } = access
        return { ok: false, refusal: refusal === "newer" || refusal === "payload" ? "store" : refusal }
      }
      loaded = { id: named.deck, revision: access.saved.revision, register: access.saved.register }
      storedIndex = access.saved.storedIndex
      const findings =
        name === "airdesign_read_deck" ? await freshFindings(host.measures, named.deck, loaded.revision) : undefined
      if (findings !== undefined && findings.revision > loaded.revision)
        loaded = (await savedAt(host.deck, named.deck, host.email, findings.revision)) ?? loaded
      session.deck = loaded
      session.findings = findings
      if (picturesAsked(name, raw)) session.pictures = await shownPictures(host.measures, loaded, raw)
      else delete session.pictures
      dropGoneTurn(session, seen)
      if (name === "airdesign_edit_deck") await fetchedImages(host, session, named.deck, raw)
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
        storedIndex,
        result,
        session.once === undefined ? undefined : { email: host.email, once: session.once },
      ),
    refund: () => refundCaller(host.session, host.email, "tool", host.agentKey),
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
  storedIndex: unknown,
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
      storedIndex,
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
  if (saved.register === null) return editRefusal(loaded, "store", nodes)
  return { lost: afterWrite(false, result, { id: loaded.id, revision: saved.revision, register: saved.register }) }
}
