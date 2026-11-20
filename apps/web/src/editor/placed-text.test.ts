import { decide, elementId, openRegister, type Register, type SlideCommand, type SlideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { hasWords, placedOn, placingText, type PlacedText } from "./placed-text"
import { storeLane } from "./store-lane"
import { elementCommand } from "@/element-edit"
import { fileSlides } from "@/slide-edit"
import { onSlide, twoBoxSlide, xml } from "@/slide-fixtures"
import type { UndoEntry } from "@/undo-list"

const room = { width: 12_192_000, height: 6_858_000 }
const words = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Hi" }] }])
const empty = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "" }] }])

function placingDeck(lane = storeLane()) {
  const parts = onSlide(xml(twoBoxSlide))
  const stored: SlideCommand[] = []
  const recorded: UndoEntry[] = []
  const shown: Register[] = []
  const entered: string[] = []
  let saved = 0
  let stops = 0
  let register = openRegister("", "")
  const ahead: SlideCommand[] = []
  const painted = () =>
    ahead.reduce((shown, edit) => {
      const decision = decide(shown, { command: "slide", file: fileSlides(parts, shown), edit })
      return decision.decision === "apply" ? decision.register : shown
    }, register)
  const held: { current: readonly PlacedText[] } = { current: [] }
  const link = {
    enqueueSlide: async (_deck: string, file: readonly SlideId[], edit: SlideCommand) => {
      const decision = decide(register, { command: "slide", file, edit })
      if (decision.decision !== "apply") return { ok: false }
      register = decision.register
      stored.push(edit)
      return { ok: true }
    },
  }
  const placing = placingText(
    {
      id: "deck-one",
      held,
      parts: () => parts,
      room: () => room,
      index: () => 0,
      painted,
      show: () => shown.push(placedOn(painted(), held.current)),
      showSaved: async () => {
        saved += 1
        shown.push(placedOn(register, held.current))
      },
      enter: (node) => entered.push(node),
      record: (entry) => recorded.push(entry),
      lane,
    },
    link,
  )
  const keys = { stop: () => (stops += 1), take: () => "" }
  return {
    placing,
    keys,
    stored,
    recorded,
    shown,
    entered,
    held,
    link,
    parts,
    ahead,
    painted,
    device: () => register,
    saved: () => saved,
    stops: () => stops,
  }
}

it("paints and enters text placed with the Text tool without storing an add or an undo step", async () => {
  const deck = placingDeck()
  await deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  expect(deck.stored).toEqual([])
  expect(deck.recorded).toEqual([])
  expect(deck.entered).toEqual(["256.4"])
  expect(deck.shown.at(-1)?.order).toContainEqual(expect.objectContaining({ slide: "element-add" }))
})

it("drops placed text left with no words: nothing stored, no undo step, and the saved slide painted again", async () => {
  const deck = placingDeck()
  await deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  expect(await deck.placing.typed(elementId("256.4"), empty)).toBe(false)
  deck.placing.left(elementId("256.4"))
  expect(deck.held.current).toEqual([])
  expect(deck.saved()).toBe(1)
  expect(deck.shown.at(-1)?.order).toEqual([])
  expect(deck.stored).toEqual([])
  expect(deck.recorded).toEqual([])
})

it("stores the add with its first words in one undo step, once, however many keys arrive before it lands", async () => {
  const deck = placingDeck()
  await deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  const node = deck.held.current[0]?.node
  if (node === undefined) throw new Error("not placed")
  const first = deck.placing.typed(node, words)
  const second = deck.placing.typed(node, words)
  expect(await first).toBe(true)
  expect(await second).toBe(true)
  expect(deck.stored).toEqual([
    expect.objectContaining({ slide: "element-add", element: expect.objectContaining({ node, value: "" }) }),
  ])
  expect(deck.recorded.map((entry) => entry.name)).toEqual(["add-box"])
  expect(await deck.placing.typed(node, words)).toBe(true)
  deck.placing.left(node)
  expect(deck.saved()).toBe(0)
})

it("lets edits of any other text through at once", async () => {
  const deck = placingDeck()
  expect(await deck.placing.typed(elementId("256.2"), words)).toBe(true)
})

it("counts a text with any character as words and an empty one as none", () => {
  expect(hasWords(words)).toBe(true)
  expect(hasWords(empty)).toBe(false)
  expect(
    hasWords(
      JSON.stringify([
        { from: 0, runs: [] },
        { from: 0, runs: [{ from: 0, text: "" }] },
      ]),
    ),
  ).toBe(false)
})

it("keeps placed text painted through a repaint from the saved register, and lets it go once stored or left", async () => {
  const deck = placingDeck()
  await deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  const saved = openRegister("", "")
  const adds = (register: Register) => register.order.filter((command) => command.slide === "element-add").length
  expect(adds(placedOn(saved, deck.held.current))).toBe(1)
  deck.placing.left(elementId("256.4"))
  expect(adds(placedOn(saved, deck.held.current))).toBe(0)
})

it("gives text placed after an insert painted ahead of the device its own element, so both adds are kept", async () => {
  const deck = placingDeck()
  const square = elementCommand(deck.parts, deck.painted(), { change: "shape", geometry: "rect", index: 0, size: room })
  if (square === null) throw new Error("no square")
  deck.ahead.push(square)
  deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  const node = deck.held.current[0]?.node
  if (node === undefined) throw new Error("not placed")
  expect(String(node)).toBe("256.5")
  await deck.link.enqueueSlide("deck-one", fileSlides(deck.parts, deck.device()), square)
  expect(await deck.placing.typed(node, words)).toBe(true)
  expect(deck.stored.map((edit) => (edit.slide === "element-add" ? String(edit.element.node) : edit.slide))).toEqual([
    "256.4",
    "256.5",
  ])
})

it("gives each text placed while the device is still storing its own element at once, and keeps the words typed in each", async () => {
  const lane = storeLane()
  const deck = placingDeck(lane)
  let release = () => undefined as void
  const busy = lane(() => new Promise<void>((done) => (release = done)))
  deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  deck.placing.place({ x: 3_048_000, y: 762_000 }, deck.keys)
  expect(deck.entered).toEqual(["256.4", "256.5"])
  const painted = deck.shown.at(-1)?.order.filter((command) => command.slide === "element-add") ?? []
  expect(painted.map((command) => (command.slide === "element-add" ? String(command.element.node) : ""))).toEqual([
    "256.4",
    "256.5",
  ])
  const first = deck.placing.typed(elementId("256.4"), words)
  const second = deck.placing.typed(elementId("256.5"), words)
  await new Promise((later) => setTimeout(later, 0))
  expect(deck.stored).toEqual([])
  release()
  await busy
  expect(await first).toBe(true)
  expect(await second).toBe(true)
  expect(deck.stored.map((edit) => (edit.slide === "element-add" ? String(edit.element.node) : edit.slide))).toEqual([
    "256.4",
    "256.5",
  ])
  expect(deck.recorded.map((entry) => entry.name)).toEqual(["add-box", "add-box"])
  expect(deck.held.current).toEqual([])
})

it("keeps placed text's element when an insert read with the held placements is stored before its first words", async () => {
  const deck = placingDeck()
  await deck.placing.place({ x: 1_524_000, y: 762_000 }, deck.keys)
  const seen = placedOn(deck.device(), deck.held.current)
  const square = elementCommand(deck.parts, seen, { change: "shape", geometry: "rect", index: 0, size: room })
  if (square === null) throw new Error("no square")
  expect((await deck.link.enqueueSlide("deck-one", fileSlides(deck.parts, seen), square)).ok).toBe(true)
  expect(await deck.placing.typed(elementId("256.4"), words)).toBe(true)
  expect(deck.stored.map((edit) => (edit.slide === "element-add" ? String(edit.element.node) : edit.slide))).toEqual([
    "256.5",
    "256.4",
  ])
})
