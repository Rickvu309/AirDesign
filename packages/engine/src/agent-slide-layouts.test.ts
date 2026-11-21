import { changeCall } from "./call-fixtures.js"
import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, floorFor, orderKeyAfter, presentSlides, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { indexDeck, openDeck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
const row = (node: string, value: string) =>
  ({ node: elementId(node), kind: "shape", value, box: null, grouped: false }) as const

function opened() {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 0,
      slides: [
        { id: "256", position: 0, layout: [row("256.2", "Click to add title")] },
        { id: "257", position: 1, layout: [row("257.2", "Click to add text"), row("257.3", "Click to add more")] },
      ],
      elements: [],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("keeps the slide an agent adds after in the section of the slide it follows, whatever layout it names", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "257" })
  if (!result.ok) throw new Error(result.refusal)
  expect(result.deck.register.order.at(-1)).toMatchObject({ slide: "add", after: "256", layout: "257" })
  expect(presentSlides(result.deck.register).map((slide) => slide.id)).toEqual(["256", "258", "257"])
})

it("gives a slide an agent adds from a slide a person added from an unused layout that layout's placeholders", () => {
  const deck = opened()
  const first = slideId("256")
  const file = [first, slideId("257")]
  const key = orderKeyAfter(presentSlides({ file, order: [] }), first)
  if (key === null) throw new Error("key")
  const floor = floorFor([row("258.2", "Click to add title"), row("258.3", "Click to add subtitle")], slideId("258"))
  const person = decide(deck.register, {
    command: "slide",
    file,
    edit: {
      slide: "add",
      id: slideId("258"),
      after: first,
      key,
      layout: first,
      layoutPart: "ppt/slideLayouts/slideLayout3.xml",
      floor,
    },
  })
  if (person.decision !== "apply") throw new Error(person.code)
  const result = changeCall("add_slide", { ...deck, register: person.register }, actor, {
    deck: "deck",
    base: 0,
    after: "258",
    layout: "258",
  })
  if (!result.ok) throw new Error(result.refusal)
  const added = result.deck.register.order.at(-1)
  expect(added).toMatchObject({ slide: "add", id: "259", layout: "258" })
  expect(added && "floor" in added ? added.floor : undefined).toEqual(floorFor(floor, slideId("259")))
})

it("adds a slide after the last one with its layout when the agent names neither", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0 })
  if (!result.ok) throw new Error(result.refusal)
  expect(result.deck.register.order.at(-1)).toMatchObject({ slide: "add", id: "258", after: "257", layout: "257" })
  expect(presentSlides(result.deck.register).map((slide) => slide.id)).toEqual(["256", "257", "258"])
})

it("uses the layout of the slide it follows when the agent names only after", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256" })
  if (!result.ok) throw new Error(result.refusal)
  const added = result.deck.register.order.at(-1)
  expect(added).toMatchObject({ slide: "add", after: "256", layout: "256" })
  expect(added && "floor" in added ? added.floor : undefined).toEqual(
    floorFor([row("256.2", "Click to add title")], slideId("258")),
  )
})
