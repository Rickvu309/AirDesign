import { createHash } from "node:crypto"

import type { DeckHost, NamedImage, UndoHost } from "@airdesign/agent"
import { type DeckId, type DoomRefusal, readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { servedFontMetrics } from "../platform/font-metrics.js"
import type { FontSource } from "../platform/font-source.js"
import { fetchImage, type ImageNet } from "../platform/image-fetch.js"
import type { OriginalStore } from "../platform/original-store.js"
import type { Sql } from "../platform/pool.js"
import { viewOpening, type DeckScreenshots } from "./deck-screenshots.js"
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
} from "./doom-deck.js"
import { runUndoRevs, withDoomWrite } from "./doom-write.js"
import { keepMedia, storedMedia } from "./media.js"

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

export type AgentHostDeps = {
  readonly deck: Sql
  readonly email: string
  readonly fonts: FontSource
  readonly originals?: OriginalStore
  readonly imageNet?: ImageNet
  readonly screenshots?: DeckScreenshots
  readonly screenshotWait?: number | undefined
}

export function agentHost(deps: AgentHostDeps): Omit<DeckHost, "admit"> {
  const { deck: db, email, fonts } = deps
  const images: ImageStore = { originals: deps.originals, net: deps.imageNet }
  const shots = deps.screenshots
  const wait = deps.screenshotWait ?? 15_000
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
        await createDoom(db, { deck: id.deck }, email, {
          ...(name === undefined ? {} : { name }),
          ...(theme === undefined ? {} : { theme }),
        }),
      )
    }),
    images: async (deck, names) => storedImages(db, deck, email, names, images),
    ...(shots === undefined
      ? {}
      : {
          openTab: () => shots.openTab(email),
          screenshots: async (deck, fold, slides) =>
            shots.take(
              deck,
              slides.map((slide) => ({ slide, key: slideKey(fold, slide) })),
              wait,
              shots.showsViews(email) ? viewOpening : 0,
            ),
        }),
    ...on(db),
    withUndo: (deck, undo) => guarded(() => withDoomWrite(db, deck, email, (client) => undo(on(client, true))))(),
  }
}
