import { readDeckId, type DeckId, type WireRefusal } from "@airdesign/catalog"
import type { Register } from "@airdesign/document"
import { rowsFromRegister, view } from "./deck-view.js"
import { markNewer } from "./device.js"
import { indexedGridOpening } from "./grid-opening.js"
import type { Remote } from "./remote.js"

export type ServedDeck =
  | { readonly ok: true; readonly revision: number; readonly register: Register; readonly saved: Register }
  | { readonly ok: false; readonly refusal: WireRefusal }

const knownByRemote = new WeakMap<Remote, Map<DeckId, number>>()

export function knownRevisions(remote: Remote): Map<DeckId, number> {
  const known = knownByRemote.get(remote) ?? new Map<DeckId, number>()
  knownByRemote.set(remote, known)
  return known
}

export function knownRevision(remote: Remote, deck: string): number | undefined {
  const parsed = readDeckId(deck)
  return parsed.ok ? knownByRemote.get(remote)?.get(parsed.deck) : undefined
}

export async function servedDeck(remote: Remote, deck: string): Promise<ServedDeck> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return parsed
  const opened = await remote.open({ deck: parsed.deck })
  if (!opened.ok) {
    if (opened.refusal === "newer") markNewer()
    return opened
  }
  const rows = rowsFromRegister(parsed.deck, opened.register)
  const shown = view(parsed.deck, rows, indexedGridOpening(opened.register.index))
  return { ok: true, revision: opened.revision, register: shown.register, saved: opened.register }
}
