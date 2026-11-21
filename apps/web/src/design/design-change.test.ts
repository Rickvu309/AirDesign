import { elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { expect, it, vi } from "vitest"
import { paintingAhead } from "@/editor/painted-ahead"
import type { DesignDeck } from "./design-change"
import { recordsInFlight } from "@/undo-list"

const link = vi.hoisted(() => ({ started: (_finish: () => void) => undefined as void }))

function holdChange() {
  return new Promise<() => void>((started) => {
    link.started = started
  })
}

vi.mock("@/design/trait-edit", async (actual) => ({
  ...(await actual<typeof import("@/design/trait-edit")>()),
  changeAhead: (): readonly Command[] => [
    { command: "add", node: elementId("256.2"), floor: "", route: "deck" },
    { command: "person", node: elementId("256.2"), value: "Wider" },
  ],
  applyChange: (_deck: unknown, _change: unknown, written: () => void) =>
    new Promise<boolean>((done) => {
      link.started(() => {
        written()
        done(true)
      })
    }),
}))

vi.mock("@/commit-edit", () => ({ flushPending: () => Promise.resolve("sent") }))

const { changeDesign } = await import("./design-change")

function heldDeck() {
  const shown: { register: Register | null; painted: number } = { register: openRegister("", "deck"), painted: 0 }
  const ahead = paintingAhead({
    shown: () => shown.register,
    keep: (register) => {
      shown.register = register
    },
    show: (register) => {
      shown.register = ahead.on(register)
      shown.painted += 1
    },
  })
  let chain: Promise<unknown> = Promise.resolve()
  const deck = {
    id: "deck-one",
    shown: {
      shownRegister: {
        get current() {
          return shown.register
        },
      },
      ahead,
      shownParts: { current: new Map() },
    },
    undo: {
      focused: { current: null },
      records: { current: recordsInFlight() },
      turnAfter: (work: () => Promise<unknown>) => {
        chain = chain.then(work)
        return chain
      },
    },
    settle: () => undefined,
  } as unknown as DesignDeck
  return { deck, shown, ahead, settled: () => chain }
}

it("paints a panel change at once, before its link reaches the device, and drops it once the link stored it", async () => {
  const { deck, shown, ahead, settled } = heldDeck()
  const release = holdChange()
  changeDesign(deck, () => ({ target: { node: elementId("256.2") } }))
  expect(shown.painted).toBe(1)
  expect(shown.register?.elements[elementId("256.2")]).toBeDefined()
  expect(ahead.on(openRegister("", "deck")).nodes).toContain(elementId("256.2"))
  const finish = await release
  finish()
  await settled()
  expect(ahead.on(openRegister("", "deck")).nodes).not.toContain(elementId("256.2"))
})

it("an export waits for a painted panel change whose link has not started", async () => {
  const { deck, shown, settled } = heldDeck()
  let finishTurn = () => undefined as void
  const turn = new Promise<void>((done) => {
    finishTurn = done
  })
  const release = holdChange()
  void deck.undo.turnAfter(() => turn)
  changeDesign(deck, () => ({ target: { node: elementId("256.2") } }))
  expect(shown.painted).toBe(1)
  const exported = vi.fn()
  const ready = deck.undo.records.current.landed().then(exported)
  await Promise.resolve()
  expect(exported).not.toHaveBeenCalled()
  finishTurn()
  const finish = await release
  finish()
  await settled()
  await ready
  expect(exported).toHaveBeenCalledOnce()
})
