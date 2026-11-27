import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

import { type DeckId, type DoomRefusal, readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { type DeckHost, type NamedImage, type UndoHost, type Session, type SlideShot } from "@airdesign/agent"
import { createServer } from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"

import { admitCaller } from "../account/caller-log.js"
import type { DeckPictures } from "../doom/deck-pictures.js"
import { servedFontMetrics } from "../platform/font-metrics.js"
import type { FontSource } from "../platform/font-source.js"
import { fetchImage, type ImageNet } from "../platform/image-fetch.js"
import { keepMedia, storedMedia } from "../doom/media.js"
import type { OriginalStore } from "../platform/original-store.js"
import type { Sql } from "../platform/pool.js"
import {
  createDoom,
  editDoom,
  lastAgentRead,
  listDoom,
  openDoom,
  personRevs,
  rememberAgentRead,
  runDoom,
  runPositions,
} from "../doom/doom-deck.js"
import { runUndoRevs, withDoomWrite } from "../doom/doom-write.js"

export type McpHost = {
  readonly deck: Sql
  readonly session: Sql
  readonly email: string
  readonly agentKey: string
  readonly agentName?: string
  readonly now: () => number
  readonly mint: () => string
  readonly hosts: readonly string[]
  readonly bodyCap: number
  readonly originals?: OriginalStore
  readonly fonts: FontSource
  readonly imageNet?: ImageNet
  readonly pictures?: DeckPictures
  readonly pictureWait?: number
  readonly fail: (error: unknown) => void
}

const measureBudget = 2_500

const refusal = (kind: Exclude<DoomRefusal["refusal"], "edit">): DoomRefusal => ({ ok: false, refusal: kind })

type Answered = Awaited<ReturnType<typeof openDoom>> | Awaited<ReturnType<typeof editDoom>>

function decoded(answer: Answered): DoomRefusal | undefined {
  if (answer.ok) return undefined
  if (answer.refusal === "edit") {
    const { ok: _ok, refusal: _refusal, ...refused } = answer
    return { ok: false, refusal: "edit", ...refused }
  }
  return { ok: false, refusal: answer.refusal }
}

function opened(deck: DeckId, answer: Awaited<ReturnType<typeof openDoom>>) {
  const unread = decoded(answer)
  if (unread !== undefined || !answer.ok) return unread ?? refusal("payload")
  const fold = doom.readFold(answer.fold)
  return fold === undefined ? refusal("payload") : ({ ok: true, deck, rev: answer.rev, fold } as const)
}

type ImageStore = { readonly originals: OriginalStore | undefined; readonly net: ImageNet | undefined }
type Pictured = { readonly pictures: DeckPictures | undefined; readonly wait: number }

const sizeOf = (bytes: Uint8Array) => {
  const size = doom.mediaSize(bytes)
  return size === null ? {} : size
}

async function namedImage(db: Sql, deck: DeckId, email: string, name: string, images: ImageStore): Promise<NamedImage> {
  if (/^[0-9a-f]{64}$/.test(name)) {
    const bytes = await storedMedia(db, deck, name, images.originals)
    return bytes === undefined ? { ok: false, refusal: "absent" } : { ok: true, asset: name, ...sizeOf(bytes) }
  }
  const fetched = await fetchImage(name, images.net)
  if (!fetched.ok) return { ok: false, refusal: fetched.refusal }
  const kept = await keepMedia(db, deck, fetched.bytes, email, images.originals)
  if (!kept.ok) return { ok: false, refusal: kept.refusal === "limit" ? "full" : "store" }
  return { ok: true, asset: kept.sha256, ...sizeOf(fetched.bytes) }
}

async function storedImages(
  db: Sql,
  deck: DeckId,
  email: string,
  names: readonly string[],
  images: ImageStore,
): Promise<ReadonlyMap<string, NamedImage>> {
  const found = new Map<string, NamedImage>()
  for (const name of names) {
    try {
      found.set(name, await namedImage(db, deck, email, name, images))
    } catch {
      found.set(name, { ok: false, refusal: "store" })
    }
  }
  return found
}

const slideKey = (fold: doom.Doom, slide: doom.NodeId) =>
  createHash("sha256").update(doom.slideKeyText(fold, slide)).digest("hex")

async function slidePictures(
  pictures: DeckPictures,
  wait: number,
  deck: DeckId,
  fold: doom.Doom,
  slides: readonly doom.NodeId[],
): Promise<ReadonlyMap<doom.NodeId, SlideShot> | "unwatched"> {
  if (!pictures.watched(deck)) return "unwatched"
  const keys = slides.map((slide) => [slide, slideKey(fold, slide)] as const)
  const previousFailures = keys.map(([slide, key]) => pictures.fontFailure(deck, slide, key))
  pictures.want(deck, slides)
  const current = () =>
    new Map<doom.NodeId, SlideShot>(
      keys.flatMap(([slide, key], at): (readonly [doom.NodeId, SlideShot])[] => {
        const data = pictures.fresh(deck, slide, key)
        if (data !== undefined) return [[slide, data]]
        const failure = pictures.fontFailure(deck, slide, key)
        return failure !== undefined && failure !== previousFailures[at] ? [[slide, { failure: "fonts" }]] : []
      }),
    )
  let shots = current()
  const until = AbortSignal.timeout(wait)
  while (shots.size < keys.length && !until.aborted) {
    await pictures.wait(deck, until)
    shots = current()
  }
  return shots
}

function doomHost(
  db: Sql,
  email: string,
  images: ImageStore,
  seen: Pictured,
  fonts: FontSource,
): Omit<DeckHost, "admit"> {
  const shots = seen.pictures
  const guarded =
    <Args extends unknown[], Result>(run: (...args: Args) => Promise<Result>) =>
    async (...args: Args): Promise<Result | DoomRefusal> => {
      try {
        return await run(...args)
      } catch {
        return refusal("server")
      }
    }
  const on = (client: Sql, forUndo = false): UndoHost => ({
    measure: (folds, layers, extraTexts) => servedFontMetrics(fonts).measure(folds, measureBudget, layers, extraTexts),
    open: guarded(async (deck) => opened(deck, await openDoom(client, { deck, forUndo }, email))),
    edit: guarded(async (deck, edit) => {
      const landed = await editDoom(client, { deck, edit: edit as unknown as Readonly<Record<string, unknown>> }, email)
      return decoded(landed) ?? (landed.ok ? ({ ok: true, deck, rev: landed.rev } as const) : refusal("server"))
    }),
    run: guarded(async (deck, run) => {
      const found = await runDoom(client, { deck, run }, email)
      return found.ok ? { ok: true, edits: found.edits, replaced: found.replaced } : found
    }),
    positionsAt: async (deck, rev, nodes) => {
      try {
        return await runPositions(client, { deck, rev, nodes }, email)
      } catch {
        return undefined
      }
    },
    undoRevs: (deck, agent) => runUndoRevs(client, deck, email, agent),
  })
  return {
    account: email,
    agentReads: {
      last: (deck, agent) => lastAgentRead(db, deck, agent),
      remember: (deck, agent, rev) => rememberAgentRead(db, deck, agent, rev),
      byPerson: (deck, revs) => personRevs(db, deck, revs),
    },
    list: guarded(async (cursor, limit) => {
      const found = await listDoom(db, email, cursor, limit + 1)
      const decks = found.slice(0, limit).flatMap((row) => {
        const id = readDeckId(row.id)
        return id.ok ? [{ deck: id.deck, name: row.name, rev: row.rev }] : []
      })
      const last = decks.at(-1)
      return {
        ok: true,
        decks,
        ...(found.length > limit && last !== undefined ? { next: last.deck } : {}),
      } as const
    }),
    create: guarded(async (name, theme, once) => {
      const id = readDeckId(createHash("sha256").update(`${email}\n${once}`).digest("hex").slice(0, 32))
      if (!id.ok) return refusal("deck")
      return opened(
        id.deck,
        await createDoom(db, { deck: id.deck }, email, { name, ...(theme === undefined ? {} : { theme }) }),
      )
    }),
    images: async (deck, names) => storedImages(db, deck, email, names, images),
    ...(shots === undefined
      ? {}
      : {
          openTab: () => shots.openTab(email),
          pictures: (deck, fold, slides) => slidePictures(shots, seen.wait, deck, fold, slides),
        }),
    ...on(db),
    withUndo: (deck, undo) => guarded(() => withDoomWrite(db, deck, email, (client) => undo(on(client, true))))(),
  }
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
  const session: Session = {
    agent: host.agentKey,
    ...(host.agentName === undefined ? {} : { name: host.agentName }),
    mint: host.mint,
  }
  const now = host.now()
  const bridge: DeckHost = {
    ...doomHost(
      host.deck,
      host.email,
      { originals: host.originals, net: host.imageNet },
      { pictures: host.pictures, wait: host.pictureWait ?? 15_000 },
      host.fonts,
    ),
    admit: (kind) => admitCaller(host.session, host.email, kind, now, host.agentKey),
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
