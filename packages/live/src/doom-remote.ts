import {
  readDeckId,
  doomRoutes,
  type DeckId,
  type DoomCaught,
  type DoomLanded,
  type DoomPictured,
  type DoomOpened,
  type DoomRan,
  type SlidePictures,
} from "@airdesign/catalog"
import { doom } from "@airdesign/document"
import { post } from "./remote.js"

export type DoomRemote = {
  create(body: { readonly deck: string }): Promise<DoomOpened>
  open(body: { readonly deck: string }): Promise<DoomOpened>
  edit(body: { readonly deck: string; readonly edit: doom.Edit }): Promise<DoomLanded>
  since(
    body: { readonly deck: string; readonly rev: number; readonly wait?: boolean; readonly pictures?: boolean },
    signal?: AbortSignal,
  ): Promise<DoomCaught>
  run?(body: { readonly deck: string; readonly run: string }): Promise<DoomRan>
  pictures?(body: {
    readonly deck: string
    readonly rev: number
    readonly pictures: SlidePictures<doom.NodeId>
  }): Promise<DoomPictured>
}

export function httpDoomRemote(): DoomRemote {
  return {
    create: async (body) => doomRoutes.create.result(await post(doomRoutes.create.path, body)),
    open: async (body) => doomRoutes.open.result(await post(doomRoutes.open.path, body)),
    edit: async (body) => doomRoutes.edit.result(await post(doomRoutes.edit.path, body)),
    since: async (body, signal) => doomRoutes.since.result(await post(doomRoutes.since.path, body, signal)),
    pictures: async (body) => doomRoutes.pictures.result(await post(doomRoutes.pictures.path, body)),
    run: async (body) => doomRoutes.run.result(await post(doomRoutes.run.path, body)),
  }
}

type Stored = {
  fold: doom.Doom
  log: doom.Landed[]
  was: Map<doom.Rev, Record<string, unknown>>
  waiting: (() => void)[]
}

const wire = (raw: unknown): unknown => JSON.parse(JSON.stringify(raw))

export function memoryDoomRemote(start: doom.Edit): DoomRemote {
  const decks = new Map<string, Stored>()
  const refusal = (name: "deck" | "cursor" | "payload") => ({ ok: false, refusal: name }) as const

  function opened(id: DeckId, stored: Stored): DoomOpened {
    return { ok: true, deck: id, rev: stored.fold.rev, fold: stored.fold }
  }

  function wake(stored: Stored) {
    for (const waiter of stored.waiting.splice(0)) waiter()
  }

  function caught(id: DeckId, stored: Stored, rev: number): DoomCaught {
    return {
      ok: true,
      deck: id,
      rev: stored.fold.rev,
      edits: stored.log.filter((landed) => landed.rev > rev).map(wire),
    }
  }

  return {
    async create(body) {
      const id = readDeckId(body.deck)
      if (!id.ok) return refusal("deck")
      if (!decks.has(id.deck)) {
        const first = { ...(wire(start) as doom.Edit), rev: doom.rev(1) }
        const next = doom.applyEdit(doom.emptyDoom, first)
        if (doom.isRefusal(next)) return refusal("payload")
        decks.set(id.deck, { fold: next, log: [first], was: new Map(), waiting: [] })
      }
      return opened(id.deck, decks.get(id.deck)!)
    },
    async open(body) {
      const id = readDeckId(body.deck)
      const stored = id.ok ? decks.get(id.deck) : undefined
      return id.ok && stored !== undefined ? opened(id.deck, stored) : refusal("deck")
    },
    async edit(body) {
      const id = readDeckId(body.deck)
      const stored = id.ok ? decks.get(id.deck) : undefined
      if (!id.ok || stored === undefined) return refusal("deck")
      const read = doom.readEdit(wire(body.edit), stored.fold)
      if (doom.isRefusal(read)) return { ok: false, refusal: "edit", ...read }
      const landed = { ...read, rev: doom.rev(stored.fold.rev + 1) }
      const next = doom.applyEdit(stored.fold, landed)
      if (doom.isRefusal(next)) return { ok: false, refusal: "edit", ...next }
      if (next === stored.fold)
        return { ok: true, deck: id.deck, rev: stored.fold.onces.get(read.once) ?? stored.fold.rev }
      if (read.author.kind === "agent" && read.author.run !== undefined)
        stored.was.set(
          landed.rev,
          Object.fromEntries(landed.writes.map((write) => [write.node, stored.fold.nodes.get(write.node) ?? null])),
        )
      stored.fold = next
      stored.log.push(landed)
      wake(stored)
      return { ok: true, deck: id.deck, rev: landed.rev }
    },
    async run(body) {
      const id = readDeckId(body.deck)
      const stored = id.ok ? decks.get(id.deck) : undefined
      if (!id.ok || stored === undefined) return refusal("deck")
      const edits = stored.log.filter((landed) => landed.author.run === body.run)
      const before: Record<string, unknown> = {}
      for (const landed of edits)
        for (const [node, snapshot] of Object.entries(stored.was.get(landed.rev) ?? {}))
          if (!(node in before)) before[node] = snapshot
      const present = Object.fromEntries(Object.entries(before).filter(([, snapshot]) => snapshot !== null))
      return { ok: true, deck: id.deck, rev: stored.fold.rev, edits: edits.map(wire), before: wire(present) as never }
    },
    async since(body, signal) {
      const id = readDeckId(body.deck)
      const stored = id.ok ? decks.get(id.deck) : undefined
      if (!id.ok || stored === undefined) return refusal("deck")
      if (body.rev > stored.fold.rev) return refusal("cursor")
      while (body.wait === true && stored.fold.rev === body.rev && signal?.aborted !== true) {
        await new Promise<void>((resolve) => {
          stored.waiting.push(resolve)
          signal?.addEventListener("abort", () => resolve(), { once: true })
        })
      }
      return caught(id.deck, stored, body.rev)
    },
  }
}
