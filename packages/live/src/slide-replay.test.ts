import type { DeckId } from "@airdesign/catalog"
import { decide, elementId, openRegister, orderKeyBetween, presentSlides, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { withSlides } from "./slide-replay.js"
import type { PendingRow } from "./store.js"

const deck = "deck" as DeckId
const file = [slideId("256"), slideId("257")] as const
const node = elementId("257.2")
const before = orderKeyBetween(null, orderKeyBetween(null, null))

function opened() {
  const added = decide(openRegister("", deck), { command: "add", node, floor: "file", route: deck })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}

function text(order: number): PendingRow {
  return { kind: "pending", deck, order, base: 0, value: "early", node }
}

function removal(order: number): PendingRow {
  return {
    kind: "pending",
    deck,
    order,
    base: 0,
    value: "",
    slideFile: file,
    slideEdit: { slide: "remove", id: file[1] },
  }
}

it("keeps text that landed before a slide was removed and drops text that arrives after", () => {
  const kept = withSlides(opened(), [], [text(0), removal(1)])
  expect(presentSlides(kept).map((spot) => spot.id)).toEqual([file[0]])
  expect(kept.elements[node]?.landed.at(-1)?.value).toBe("early")
  const late = withSlides(
    opened(),
    [
      {
        kind: "confirmed",
        deck,
        revision: 0,
        value: "",
        slideFile: file,
        slideEdit: { slide: "remove", id: file[1] },
      },
    ],
    [{ kind: "pending", deck, order: 0, base: 0, value: "late", node }],
  )
  expect(presentSlides(late).map((spot) => spot.id)).toEqual([file[0]])
  expect(late.elements[node]?.landed).toEqual([])
})

it("sorts a move ahead of the slide it passes", () => {
  const moved = withSlides(
    openRegister("", deck),
    [],
    [
      {
        kind: "pending",
        deck,
        order: 0,
        base: 0,
        value: "",
        slideFile: file,
        slideEdit: { slide: "move", id: file[1], key: before },
      },
    ],
  )
  expect(presentSlides(moved).map((spot) => spot.id)).toEqual([file[1], file[0]])
})
