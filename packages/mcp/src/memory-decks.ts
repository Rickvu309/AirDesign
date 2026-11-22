import { readDeckId, type DeckId, type SceneRefusal } from "@airdesign/catalog"
import { scene } from "@airdesign/document"

import type { DeckHost, Landed } from "./deck-host.js"
import { shortHash } from "./once-ids.js"

export type MemoryDecks = DeckHost & { readonly decks: Map<DeckId, scene.Scene> }

const refusal = (kind: Exclude<SceneRefusal["refusal"], "edit">): SceneRefusal => ({ ok: false, refusal: kind })

export function memoryDecks(
  start: () => scene.Scene,
  initial: ReadonlyMap<string, scene.Scene> = new Map(),
): MemoryDecks {
  const decks = new Map<DeckId, scene.Scene>()
  for (const [id, fold] of initial) {
    const read = readDeckId(id)
    if (!read.ok) throw new Error(id)
    decks.set(read.deck, fold)
  }
  const edit: DeckHost["edit"] = async (deck, sent): Promise<Landed | SceneRefusal> => {
    const fold = decks.get(deck)
    if (fold === undefined) return refusal("deck")
    const read = scene.readEdit(JSON.parse(JSON.stringify(sent)), fold)
    if (scene.isRefusal(read)) return { ok: false, refusal: "edit", ...read }
    const landed = { ...read, rev: scene.rev(fold.rev + 1) }
    const next = scene.applyEdit(fold, landed)
    if (scene.isRefusal(next)) return { ok: false, refusal: "edit", ...next }
    if (next === fold) return { ok: true, deck, rev: fold.onces.get(read.once) ?? fold.rev }
    decks.set(deck, next)
    return { ok: true, deck, rev: landed.rev }
  }
  return {
    decks,
    list: async () => ({
      ok: true,
      decks: [...decks].map(([deck, fold]) => ({ deck, name: scene.deckName(fold), rev: fold.rev })),
    }),
    create: async (name, once) => {
      const read = readDeckId(`d${shortHash(once)}`)
      if (!read.ok) return refusal("deck")
      if (!decks.has(read.deck)) decks.set(read.deck, start())
      const present = decks.get(read.deck)!
      if (scene.deckName(present) === name) return { ok: true, deck: read.deck, rev: present.rev, fold: present }
      const named = await edit(read.deck, {
        once: "name",
        author: { kind: "person", id: "start" },
        writes: [{ node: deckNode(present), prop: "name", value: name }],
      })
      if (!named.ok) return named
      const fold = decks.get(read.deck)!
      return { ok: true, deck: read.deck, rev: fold.rev, fold }
    },
    open: async (deck) => {
      const fold = decks.get(deck)
      return fold === undefined ? refusal("deck") : { ok: true, deck, rev: fold.rev, fold }
    },
    edit,
  }
}

function deckNode(fold: scene.Scene): scene.NodeId {
  for (const node of fold.nodes.values()) if (node.type === "deck") return node.id
  throw new Error("a deck has a deck node")
}
