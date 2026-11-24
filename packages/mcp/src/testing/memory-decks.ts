import { readDeckId, type DeckId, type DoomRefusal } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import type { DeckHost, Landed } from "../deck-host.js"
import { shortHash } from "../once-ids.js"

export type MemoryDecks = DeckHost & { readonly decks: Map<DeckId, doom.Doom> }

const refusal = (kind: Exclude<DoomRefusal["refusal"], "edit">): DoomRefusal => ({ ok: false, refusal: kind })

export function memoryDecks(start: () => doom.Doom, initial: ReadonlyMap<string, doom.Doom> = new Map()): MemoryDecks {
  const decks = new Map<DeckId, doom.Doom>()
  const logs = new Map<DeckId, { edit: unknown; replaced: unknown }[]>()
  for (const [id, fold] of initial) {
    const read = readDeckId(id)
    if (!read.ok) throw new Error(id)
    decks.set(read.deck, fold)
  }
  const edit: DeckHost["edit"] = async (deck, sent): Promise<Landed | DoomRefusal> => {
    const fold = decks.get(deck)
    if (fold === undefined) return refusal("deck")
    const read = doom.readEdit(JSON.parse(JSON.stringify(sent)), fold)
    if (doom.isRefusal(read)) return { ok: false, refusal: "edit", ...read }
    const replaced = doom.replacedBy(fold, read)
    const landed = { ...read, rev: doom.rev(fold.rev + 1) }
    const next = doom.applyEdit(fold, landed)
    if (doom.isRefusal(next)) return { ok: false, refusal: "edit", ...next }
    if (next === fold) return { ok: true, deck, rev: fold.onces.get(read.once) ?? fold.rev }
    decks.set(deck, next)
    const log = logs.get(deck) ?? []
    log.push(JSON.parse(JSON.stringify({ edit: landed, replaced })))
    logs.set(deck, log)
    return { ok: true, deck, rev: landed.rev }
  }
  return {
    decks,
    list: async () => ({
      ok: true,
      decks: [...decks].map(([deck, fold]) => ({ deck, name: doom.deckName(fold), rev: fold.rev })),
    }),
    create: async (name, once) => {
      const read = readDeckId(`d${shortHash(once)}`)
      if (!read.ok) return refusal("deck")
      if (!decks.has(read.deck)) decks.set(read.deck, start())
      const present = decks.get(read.deck)!
      if (doom.deckName(present) === name) return { ok: true, deck: read.deck, rev: present.rev, fold: present }
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
    run: async (deck, run) => {
      if (!decks.has(deck)) return refusal("deck")
      const rows = (logs.get(deck) ?? []).filter(
        (row) => (row.edit as { author?: { run?: string } }).author?.run === run,
      )
      return { ok: true, edits: rows.map((row) => row.edit), replaced: rows.map((row) => row.replaced) }
    },
  }
}

function deckNode(fold: doom.Doom): doom.NodeId {
  for (const node of fold.nodes.values()) if (node.type === "deck") return node.id
  throw new Error("a deck has a deck node")
}
