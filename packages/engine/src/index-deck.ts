import { readDeckIndex, type CallRefusal } from "@airdesign/catalog"
import { appendIndex } from "@airdesign/document"
import type { Caller, Deck } from "./call.js"

export function indexDeck(
  deck: Deck,
  caller: Caller,
  raw: unknown,
): { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly refusal: CallRefusal } {
  if (caller.actor !== "person") return { ok: false, refusal: "field" }
  const parsed = readDeckIndex(raw)
  if (!parsed.ok) return parsed
  if (parsed.deck !== deck.id) return { ok: false, refusal: "deck" }
  const { ok: _ok, deck: _deck, ...page } = parsed
  const next = appendIndex(deck.register.index, page)
  if (!next.ok) return next
  if (next.index === deck.register.index) return { ok: true, deck }
  return { ok: true, deck: { ...deck, register: { ...deck.register, index: next.index } } }
}
