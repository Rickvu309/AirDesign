import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  format,
  landedPatch,
  openRegister,
  openingElement,
  orderKeyBetween,
  readSlideState,
  slideId,
  upgradeBackgrounds,
  undoSlides,
  type Command,
  type Register,
  type SlideCommand,
} from "./index.js"

const file = [slideId("256"), slideId("257")]
const first = slideId("256")
const accent = { scheme: "accent1" } as const
const navy = { rgb: "0F2433" } as const
const firstNode = elementId("256.slide")
const key = orderKeyBetween(null, null)

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function stored(order: readonly unknown[]): Register {
  const state = readSlideState({ file, order })
  if (state === undefined) throw new Error("order")
  return { ...openRegister("", "deck"), ...state }
}

function fillOf(register: Register, node: string) {
  const body = register.elements[elementId(node)]
  return body === undefined ? undefined : landedPatch(body, "text").fill?.value
}

describe("upgradeBackgrounds", () => {
  it("leaves a register with no background command as it is", () => {
    const register = stored([{ slide: "clone", id: "900", source: "256", key }])
    expect(upgradeBackgrounds(register)).toBe(register)
  })

  it("turns each stored colour into a fill row on the slide's own node, the last one winning", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: accent },
        { slide: "background", id: "256", color: navy },
      ]),
    )
    expect(view.order).toEqual([])
    expect(view.nodes).toContain(firstNode)
    expect(view.elements[firstNode]?.landed).toEqual([
      { actor: "person", visible: true, v: format, patch: { fill: { value: { set: { solid: accent } } } } },
      { actor: "person", visible: true, v: format, patch: { fill: { value: { set: { solid: navy } } } } },
    ])
    expect(fillOf(view, "256.slide")).toEqual({ set: { solid: navy } })
    expect(fillOf(view, "257.slide")).toBeUndefined()
  })

  it("reads a stored null as the background the slide opened with", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "background", id: "256", color: null },
      ]),
    )
    expect(fillOf(view, "256.slide")).toBe("opening")
  })

  it("keeps a run's colour as the agent's row of that run", () => {
    const view = upgradeBackgrounds(stored([{ slide: "background", id: "256", color: accent, runId: "run" }]))
    expect(view.elements[firstNode]?.landed).toEqual([
      {
        actor: "agent",
        visible: true,
        runId: "run",
        v: format,
        patch: { fill: { value: { set: { solid: accent } } } },
      },
    ])
  })

  it("opens a clone with the colour its source showed when it was copied", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "clone", id: "900", source: "256", key },
        { slide: "background", id: "256", color: accent },
      ]),
    )
    expect(openingElement(view, elementId("900.slide"))).toEqual({
      node: elementId("900.slide"),
      kind: "slide",
      value: null,
      box: null,
      grouped: false,
      opening: { fill: { value: { set: { solid: navy } } } },
    })
    expect(fillOf(view, "900.slide")).toBeUndefined()
  })

  it("opens a clone of a clone with the colour the first clone copied (G3)", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "clone", id: "900", source: "256", key },
        { slide: "background", id: "256", color: null },
        { slide: "clone", id: "901", source: "900", key: orderKeyBetween(key, null) },
      ]),
    )
    expect(openingElement(view, elementId("901.slide"))?.opening).toEqual({
      fill: { value: { set: { solid: navy } } },
    })
  })

  it("takes a null on a clone back to the colour the clone copied, not to the file (G4)", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "clone", id: "900", source: "256", key },
        { slide: "background", id: "900", color: accent },
        { slide: "background", id: "900", color: null },
      ]),
    )
    expect(fillOf(view, "900.slide")).toBe("opening")
    expect(openingElement(view, elementId("900.slide"))?.opening).toEqual({
      fill: { value: { set: { solid: navy } } },
    })
  })

  it("opens no clone whose source showed its file background", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "257", color: navy },
        { slide: "clone", id: "900", source: "256", key },
      ]),
    )
    expect(openingElement(view, elementId("900.slide"))).toBeUndefined()
  })

  it("keeps a clone's own slide node, which a clone made after this upgrade always carries", () => {
    const own = { node: "900.slide", kind: "slide", value: null, box: null, grouped: false }
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "clone", id: "900", source: "256", key, floor: [own] },
      ]),
    )
    expect(openingElement(view, elementId("900.slide"))?.opening).toBeUndefined()
  })

  it("puts its rows before the rows the slide's node stored since", () => {
    const old = stored([{ slide: "background", id: "256", color: navy }])
    const added = landed(old, { command: "add", node: firstNode, floor: "", route: "deck" })
    const after = landed(added, {
      command: "person",
      v: format,
      patch: { fill: { value: { set: { solid: accent } } } },
      node: firstNode,
    })
    const view = upgradeBackgrounds(after)
    expect(view.elements[firstNode]?.landed.map((row) => row.v !== undefined && row.patch.fill?.value)).toEqual([
      { set: { solid: navy } },
      { set: { solid: accent } },
    ])
    expect(after.order).toHaveLength(1)
    expect(after.elements[firstNode]?.landed).toHaveLength(1)
  })

  it("gives the same view when run twice", () => {
    const view = upgradeBackgrounds(
      stored([
        { slide: "background", id: "256", color: navy },
        { slide: "clone", id: "900", source: "256", key },
      ]),
    )
    expect(upgradeBackgrounds(view)).toBe(view)
  })
})

describe("a run's stored background colours", () => {
  it("takes back every colour a run set and leaves a person's colour on another slide", () => {
    const runId = "run"
    const register = stored([
      { slide: "background", id: "257", color: navy },
      { slide: "background", id: "256", color: navy },
      { slide: "background", id: "256", color: accent, runId },
      { slide: "background", id: "256", color: { scheme: "dk2" }, runId },
    ])
    const undone = undoSlides(register, runId)
    if (undone === null) throw new Error("undo")
    const view = upgradeBackgrounds(undone)
    expect(fillOf(view, "256.slide")).toEqual({ set: { solid: navy } })
    expect(fillOf(view, "257.slide")).toEqual({ set: { solid: navy } })
    expect(undone.order).toEqual(register.order)
  })

  it("refuses to take back a run's colour a person changed since", () => {
    const runId = "run"
    const register = stored([
      { slide: "background", id: "256", color: accent, runId },
      { slide: "background", id: "256", color: navy },
    ])
    expect(undoSlides(register, runId)).toBeNull()
  })
})

it("still reads PR 478's stored colours, and only those", () => {
  const read = (color: unknown) => readSlideState({ file, order: [{ slide: "background", id: "256", color }] })
  const order: SlideCommand[] = [{ slide: "background", id: first, color: accent }]
  expect(read(accent)?.order).toEqual(order)
  expect(read(null)?.order).toEqual([{ slide: "background", id: first, color: null }])
  const darker = { scheme: "hlink", transforms: [{ op: "lumMod", val: 75000 }] }
  expect(read(darker)?.order).toEqual([{ slide: "background", id: first, color: darker }])
  expect(read({ scheme: "phClr" })).toBeUndefined()
  expect(read({ rgb: "0f2433" })).toBeUndefined()
  expect(read("accent1")).toBeUndefined()
})
