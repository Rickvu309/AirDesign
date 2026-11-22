import {
  readDeckId,
  sceneRoutes,
  type DeckId,
  type SceneCaught,
  type SceneLanded,
  type ScenePictured,
  type SceneOpened,
  type SceneRan,
  type SlidePictures,
} from "@airdesign/catalog"
import { scene } from "@airdesign/document"
import { post } from "./remote.js"

export type SceneRemote = {
  create(body: { readonly deck: string }): Promise<SceneOpened>
  open(body: { readonly deck: string }): Promise<SceneOpened>
  edit(body: { readonly deck: string; readonly edit: scene.Edit }): Promise<SceneLanded>
  since(
    body: { readonly deck: string; readonly rev: number; readonly wait?: boolean; readonly pictures?: boolean },
    signal?: AbortSignal,
  ): Promise<SceneCaught>
  run?(body: { readonly deck: string; readonly run: string }): Promise<SceneRan>
  pictures?(body: {
    readonly deck: string
    readonly rev: number
    readonly pictures: SlidePictures<scene.NodeId>
  }): Promise<ScenePictured>
}

export function httpSceneRemote(): SceneRemote {
  return {
    create: async (body) => sceneRoutes.create.result(await post(sceneRoutes.create.path, body)),
    open: async (body) => sceneRoutes.open.result(await post(sceneRoutes.open.path, body)),
    edit: async (body) => sceneRoutes.edit.result(await post(sceneRoutes.edit.path, body)),
    since: async (body, signal) => sceneRoutes.since.result(await post(sceneRoutes.since.path, body, signal)),
    pictures: async (body) => sceneRoutes.pictures.result(await post(sceneRoutes.pictures.path, body)),
    run: async (body) => sceneRoutes.run.result(await post(sceneRoutes.run.path, body)),
  }
}

type Stored = {
  fold: scene.Scene
  log: scene.Landed[]
  was: Map<scene.Rev, Record<string, unknown>>
  waiting: (() => void)[]
}

const wire = (raw: unknown): unknown => JSON.parse(JSON.stringify(raw))

export function memorySceneRemote(start: scene.Edit): SceneRemote {
  const decks = new Map<string, Stored>()
  const refusal = (name: "deck" | "cursor" | "payload") => ({ ok: false, refusal: name }) as const

  function opened(id: DeckId, stored: Stored): SceneOpened {
    return { ok: true, deck: id, rev: stored.fold.rev, fold: stored.fold }
  }

  function wake(stored: Stored) {
    for (const waiter of stored.waiting.splice(0)) waiter()
  }

  function caught(id: DeckId, stored: Stored, rev: number): SceneCaught {
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
        const first = { ...(wire(start) as scene.Edit), rev: scene.rev(1) }
        const next = scene.applyEdit(scene.emptyScene, first)
        if (scene.isRefusal(next)) return refusal("payload")
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
      const read = scene.readEdit(wire(body.edit), stored.fold)
      if (scene.isRefusal(read)) return { ok: false, refusal: "edit", ...read }
      const landed = { ...read, rev: scene.rev(stored.fold.rev + 1) }
      const next = scene.applyEdit(stored.fold, landed)
      if (scene.isRefusal(next)) return { ok: false, refusal: "edit", ...next }
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
