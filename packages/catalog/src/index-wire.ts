import { readIndexPage, type IndexPage } from "@airdesign/document"
import { fieldRefusal, knownKeys, readDeckId, recordOf, type DeckId } from "./wire.js"

export function readDeckIndex(
  raw: unknown,
):
  | ({ readonly ok: true; readonly deck: DeckId } & IndexPage)
  | { readonly ok: false; readonly refusal: "deck" | "field" } {
  const body = recordOf(raw)
  if (
    body === undefined ||
    !knownKeys(body, [
      "deck",
      "format",
      "once",
      "offset",
      "total",
      "palettes",
      "templates",
      "templateStyles",
      "sectionStarts",
      "slides",
      "elements",
    ])
  )
    return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deck
  const { deck: _deck, ...rest } = body
  const page = readIndexPage(rest)
  if (page === null) return fieldRefusal
  return { ok: true, deck: deck.deck, ...page }
}
