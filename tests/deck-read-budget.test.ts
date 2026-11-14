import { readFileSync } from "node:fs"
import { readDeckId } from "@airdesign/catalog"
import {
  nextSlideId,
  orderKeyBetween,
  readSlideId,
  type OrderKey,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { indexDeck, openDeck, readDeckPage, readLead, readReport, withinRead, type Deck } from "@airdesign/engine"
import { indexPages } from "@airdesign/live"
import { orderedParts, readPackage } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { indexedParts } from "../apps/web/src/index-deck.js"

async function doeAtFifty() {
  const read = await readPackage(new Uint8Array(readFileSync("scripts/pptx-fixtures/doe-heat-pumps.pptx")))
  if (!read.ok) throw new Error(read.reason)
  const file = indexedParts(read.parts).slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const order: SlideCommand[] = []
  const ids: SlideId[] = [...file]
  let key: OrderKey | null = null
  let after = file[file.length - 1]!
  while (ids.length < 50) {
    const id = nextSlideId(ids)
    key = orderKeyBetween(key, null)
    order.push({ slide: "add", id, after, layout: file[1]!, key })
    ids.push(id)
    after = id
  }
  return orderedParts(read.parts, { file, order })
}

it("reads a 50-slide deck's design in at most 10 read_deck pages, one line per element", async () => {
  const parsed = readDeckId("read-budget")
  if (!parsed.ok) throw new Error(parsed.refusal)
  const index = indexedParts(await doeAtFifty())
  let once = 0
  const pages = indexPages(index, () => `page-${String((once += 1))}`)
  if (!pages.ok) throw new Error(pages.refusal)
  let deck: Deck = openDeck(parsed.deck)
  for (const page of pages.pages) {
    const indexed = indexDeck(deck, { actor: "person" }, { deck: parsed.deck, ...page })
    if (!indexed.ok) throw new Error(indexed.refusal)
    deck = indexed.deck
  }
  const read: string[] = []
  let cursor: string | undefined
  let count = 0
  do {
    const answer = readDeckPage(deck, { runId: null, ...(cursor === undefined ? {} : { cursor }) })
    expect(withinRead(readReport(readLead(answer.revision), answer))).toBe(true)
    read.push(...answer.elements.flatMap((element) => (element.design === undefined ? [] : [element.design])))
    cursor = answer.cursor
    count += 1
  } while (cursor !== undefined)
  expect(count).toBeLessThanOrEqual(10)
  expect(read.length).toBe(index.elements.filter((element) => element.design !== undefined).length)
})
