import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, openingElement, type DeckIndex, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const accent2 = { set: { solid: { scheme: "accent2" } } }
const hex = "0F2433"
const navy = { set: { solid: { rgb: hex } } }

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: 0,
    slides: [
      { id: "256", position: 0, size, free: 9 },
      { id: "257", position: 1, size, free: 9 },
    ],
    elements: [],
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index, file: [], order: [] } }
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function filled(deck: Deck, target: string, value: unknown) {
  const started = landed(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: `${target}.slide` }] }),
  )
  return call("edit_deck", started, agent, {
    deck: "deck",
    base: started.revision,
    changes: [{ op: "set", target, fill: { value } }],
  })
}

function fillOf(register: Register, node: string) {
  const body = register.elements[elementId(node)]
  return body === undefined ? undefined : landedPatch(body, "text").fill?.value
}

it("fills a slide's background from a slide target as the agent's row, and undo_run takes it back", () => {
  const deck = landed(filled(indexed(), "256", "accent2"))
  expect(deck.register.elements[elementId("256.slide")]?.landed).toEqual([
    { actor: "agent", runId: "run", visible: true, v: expect.any(Number), patch: { fill: { value: accent2 } } },
  ])
  expect(fillOf(deck.register, "257.slide")).toBeUndefined()
  const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
  expect(fillOf(undone.register, "256.slide")).toBeUndefined()
})

it("takes the slide's background back to its layout's with null", () => {
  const deck = landed(filled(indexed(), "257", null))
  expect(fillOf(deck.register, "257.slide")).toBe("inherit")
})

it("refuses text on a slide and a slide that is not there", () => {
  const deck = indexed()
  const started = landed(
    call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "256.slide" }] }),
  )
  const text = call("edit_deck", started, agent, {
    deck: "deck",
    base: started.revision,
    changes: [{ op: "set", target: "256", text: { value: "words" } }],
  })
  expect(text).toEqual({ ok: false, refusal: "kind" })
  expect(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "300.slide" }] })).toEqual({
    ok: false,
    refusal: "dead",
  })
})

it("gives a duplicate the background its source's fill row shows, and no opening when the source shows its layout's", () => {
  const rowed = landed(filled(indexed(), "256", `#${hex}`))
  const copy = landed(call("duplicate_slide", rowed, agent, { deck: "deck", base: rowed.revision, slide: "256" }))
  const minted = copy.register.order.at(-1)?.id ?? ""
  expect(openingElement(copy.register, elementId(`${minted}.slide`))?.opening).toEqual({ fill: { value: navy } })
  const plain = landed(call("duplicate_slide", indexed(), agent, { deck: "deck", base: 0, slide: "257" }))
  const blank = plain.register.order.at(-1)?.id ?? ""
  expect(openingElement(plain.register, elementId(`${blank}.slide`))).toEqual({
    node: `${blank}.slide`,
    kind: "slide",
    value: null,
    box: null,
    grouped: false,
  })
})
