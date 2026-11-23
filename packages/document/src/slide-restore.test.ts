import { describe, expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { elementId, slideId } from "./element-id.js"
import { orderKeyBetween } from "@airdesign/doom"
import { foldSlides, presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"
import { openingElement } from "./slide-floor.js"

const file = [slideId("256"), slideId("257"), slideId("258")] as const

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

describe("slide restore", () => {
  it("brings a removed slide back at the key it names", () => {
    const removed = applied(openRegister("", ""), { slide: "remove", id: file[1] })
    const back = presentSlides({ file, order: [] }).find((spot) => spot.id === file[1])?.key
    if (back === undefined) throw new Error("key")
    const restored = applied(removed, { slide: "restore", id: file[1], key: back })
    expect(presentSlides(restored).map((spot) => spot.id)).toEqual(["256", "257", "258"])
    expect(foldSlides(restored).find((spot) => spot.id === file[1])).toMatchObject({ present: true, key: back })
  })

  it("restores a removed slide at a new key", () => {
    const removed = applied(openRegister("", ""), { slide: "remove", id: file[0] })
    const last = presentSlides(removed).at(-1)?.key ?? null
    const restored = applied(removed, { slide: "restore", id: file[0], key: orderKeyBetween(last, null) })
    expect(presentSlides(restored).map((spot) => spot.id)).toEqual(["257", "258", "256"])
  })

  it("refuses to restore a slide that is present or was never made, as dead, so a queued restore drops", () => {
    const opened = openRegister("", "")
    const key = orderKeyBetween(null, null)
    expect(decide(opened, { command: "slide", file, edit: { slide: "restore", id: file[0], key } })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    expect(decide(opened, { command: "slide", file, edit: { slide: "restore", id: slideId("300"), key } })).toEqual({
      decision: "refuse",
      code: "dead",
    })
  })

  it("lets a person edit an element of a restored slide again, and keeps a cloned slide's opening elements", () => {
    const row = { node: elementId("259.2"), kind: "shape" as const, value: "Title", box: null, grouped: false }
    const cloned = applied(openRegister("", ""), {
      slide: "clone",
      id: slideId("259"),
      source: file[0],
      key: orderKeyBetween(null, null),
      floor: [row],
    })
    const removed = applied(cloned, { slide: "remove", id: slideId("259") })
    expect(decide(removed, { command: "add", node: row.node, floor: "", route: "" }).decision).toBe("apply")
    const added = decide(removed, { command: "add", node: row.node, floor: "", route: "" })
    if (added.decision !== "apply") throw new Error(added.code)
    expect(decide(added.register, { command: "person", value: "Gone", node: row.node })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    const restored = applied(added.register, { slide: "restore", id: slideId("259"), key: orderKeyBetween(null, null) })
    expect(decide(restored, { command: "person", value: "Back", node: row.node }).decision).toBe("apply")
    expect(openingElement(restored, row.node)).toEqual(row)
  })

  it("reads a restore from its stored form", () => {
    const key = orderKeyBetween(null, null)
    expect(readSlideState({ file: ["256"], order: [{ slide: "restore", id: "256", key }] })).toEqual({
      file: [slideId("256")],
      order: [{ slide: "restore", id: slideId("256"), key }],
    })
    expect(readSlideState({ file: ["256"], order: [{ slide: "restore", id: "256" }] })).toBeUndefined()
  })
})
