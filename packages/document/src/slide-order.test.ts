import { describe, expect, it } from "vitest"
import { decide, openRegister, version } from "./decide.js"
import { elementId, slideId, type SlideId } from "./element-id.js"
import { orderKeyBetween, type OrderKey } from "./order-key.js"
import { limits } from "./limits.js"
import { foldSlides, orderKeyAfter, presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"

const file = [slideId("256"), slideId("257")] as const

function keyAfter(ids: readonly SlideId[], after: SlideId): OrderKey {
  const present = presentSlides({ file: ids, order: [] })
  const key = orderKeyAfter(present, after)
  if (key === null) throw new Error("key")
  return key
}

function slide(register: ReturnType<typeof openRegister>, edit: SlideCommand, known: readonly SlideId[] = file) {
  return decide(register, { command: "slide", file: known, edit })
}

describe("slide order", () => {
  it("inserts a blank slide after the named slide and a clone just after its source", () => {
    const opened = openRegister("", "")
    const added = slide(opened, {
      slide: "add",
      id: slideId("258"),
      after: file[0],
      key: keyAfter(file, file[0]),
      layout: file[0],
    })
    if (added.decision !== "apply") throw new Error(added.code)
    const cloned = slide(added.register, {
      slide: "clone",
      id: slideId("259"),
      source: file[1],
      key: keyAfter(file, file[1]),
    })
    if (cloned.decision !== "apply") throw new Error(cloned.code)
    expect(presentSlides(cloned.register).map((spot) => spot.id)).toEqual(["256", "258", "257", "259"])
    expect(foldSlides(cloned.register).find((spot) => spot.id === "258")?.birth).toEqual({
      from: "blank",
      layout: "256",
    })
    expect(foldSlides(cloned.register).find((spot) => spot.id === "259")?.birth).toEqual({
      from: "clone",
      source: "257",
    })
  })

  it("keeps the layout part a slide was added with in its birth", () => {
    const layoutPart = "ppt/slideLayouts/slideLayout2.xml"
    const added = slide(openRegister("", ""), {
      slide: "add",
      id: slideId("258"),
      after: file[0],
      key: keyAfter(file, file[0]),
      layout: file[0],
      layoutPart,
    })
    if (added.decision !== "apply") throw new Error(added.code)
    expect(foldSlides(added.register).find((spot) => spot.id === "258")?.birth).toEqual({
      from: "blank",
      layout: "256",
      layoutPart,
    })
    expect(readSlideState(JSON.parse(JSON.stringify({ file, order: added.register.order })))?.order).toEqual(
      added.register.order,
    )
  })

  it("refuses to remove the last slide and selects no absence for a file the edit never named", () => {
    const opened = openRegister("", "")
    const only = slide(opened, { slide: "remove", id: file[0] }, [file[0]])
    expect(only).toEqual({ decision: "refuse", code: "dead" })
    expect(presentSlides(opened).map((spot) => spot.id)).toEqual([])
  })

  it("removes a slide, keeps its row, and refuses a later move of it", () => {
    const opened = openRegister("", "")
    const removed = slide(opened, { slide: "remove", id: file[1] })
    if (removed.decision !== "apply") throw new Error(removed.code)
    expect(presentSlides(removed.register).map((spot) => spot.id)).toEqual(["256"])
    expect(foldSlides(removed.register).find((spot) => spot.id === "257")?.present).toBe(false)
    const moved = slide(removed.register, {
      slide: "move",
      id: file[1],
      key: orderKeyBetween(null, presentSlides(removed.register)[0]?.key ?? null),
    })
    expect(moved).toEqual({ decision: "refuse", code: "dead" })
  })

  it("sorts two inserts that chose the same gap by slide id", () => {
    const opened = openRegister("", "")
    const key = keyAfter(file, file[0])
    const first = slide(opened, { slide: "add", id: slideId("300"), after: file[0], key, layout: file[0] })
    if (first.decision !== "apply") throw new Error(first.code)
    const second = slide(first.register, { slide: "add", id: slideId("270"), after: file[0], key, layout: file[0] })
    if (second.decision !== "apply") throw new Error(second.code)
    expect(presentSlides(second.register).map((spot) => spot.id)).toEqual(["256", "270", "300", "257"])
  })

  it("refuses a fifty-first slide and a second file list", () => {
    const many = Array.from({ length: limits.slides }, (_, index) => slideId(String(index + 1)))
    const opened = openRegister("", "")
    const extra = slide(
      opened,
      {
        slide: "add",
        id: slideId("999"),
        after: many[0] ?? slideId("1"),
        key: keyAfter(many, many[0] ?? slideId("1")),
        layout: many[0] ?? slideId("1"),
      },
      many,
    )
    expect(extra).toEqual({ decision: "refuse", code: "limit" })
    const named = slide(opened, { slide: "remove", id: file[1] })
    if (named.decision !== "apply") throw new Error(named.code)
    expect(slide(named.register, { slide: "remove", id: file[0] }, [file[0], file[1], slideId("258")])).toEqual({
      decision: "refuse",
      code: "stale",
    })
  })

  it("lets a reorder land while an agent edit on another slide still applies, and refuses text on a slide that was removed", () => {
    const opened = openRegister("", "")
    const node = elementId("257.2")
    const kept = elementId("256.2")
    const started = decide(opened, { command: "add", node, floor: "file", route: "txBody" })
    if (started.decision !== "apply") throw new Error(started.code)
    const other = decide(started.register, { command: "add", node: kept, floor: "file", route: "txBody" })
    if (other.decision !== "apply") throw new Error(other.code)
    const running = decide(other.register, { command: "start", runId: "run", node })
    if (running.decision !== "apply") throw new Error(running.code)
    const keptRunning = decide(running.register, { command: "start", runId: "run", node: kept })
    if (keptRunning.decision !== "apply") throw new Error(keptRunning.code)
    const removed = slide(keptRunning.register, { slide: "remove", id: file[1] })
    if (removed.decision !== "apply") throw new Error(removed.code)
    const moved = slide(removed.register, {
      slide: "move",
      id: file[0],
      key: orderKeyBetween(presentSlides(removed.register)[0]?.key ?? null, null),
    })
    if (moved.decision !== "apply") throw new Error(moved.code)
    const keptBody = moved.register.elements[kept]
    if (keptBody === undefined) throw new Error("element")
    const before = version(keptBody)
    const text = decide(moved.register, { command: "agent", runId: "run", readAt: before, node: kept, value: "kept" })
    if (text.decision !== "apply") throw new Error(text.code)
    expect(version(text.register.elements[kept]!)).toBe(before + 1)
    expect(decide(text.register, { command: "agent", runId: "run", readAt: before, node, value: "gone" })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    expect(presentSlides(text.register).map((spot) => spot.id)).toEqual(["256"])
  })
})
