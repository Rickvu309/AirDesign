import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  groupedNow,
  groupFrame,
  openRegister,
  placeOf,
  rebased,
  shownPlace,
  slideId,
  throughGroup,
  undoOf,
  ungroupTurn,
  type Command,
  type ElementId,
  type IndexElement,
  type Place,
  type Register,
  type Undoable,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const g = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const turned = elementId("256.8")
const inside = elementId("256.9")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  {
    node: g,
    kind: "group",
    value: null,
    box: { x: 1000, y: 1000, cx: 400, cy: 200 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 200, cy: 100 },
  },
  { node: first, kind: "shape", value: "", box: { x: 0, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  { node: second, kind: "shape", value: "", box: { x: 100, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  {
    node: turned,
    kind: "group",
    value: null,
    box: { x: 3000, y: 0, cx: 100, cy: 100 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 100, cy: 100 },
    design: { "box.rot": [90] },
  },
  { node: inside, kind: "shape", value: "", box: { x: 0, y: 0, cx: 100, cy: 100 }, grouped: true, group: turned },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 20, animated: [] }],
    elements,
    pages: [{ once: "page", offset: 0, count: elements.length }],
  },
}

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") throw new Error(opened.code)
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function joined(register: Register, node: ElementId, frame: ElementId | null, before: ElementId | null = null) {
  const changed = changeLayout(register, { move: node, frame, before, file })
  if (changed === null || !("turn" in changed)) return null
  return changed.turn
}

function onSlide(register: Register, node: ElementId): Place | null {
  const own = placeOf(register, node)
  const parent = own === null ? null : groupedNow(register, node) ? g : null
  if (own === null || parent === null) return own
  const group = placeOf(register, parent)
  const frame = groupFrame(register, parent)
  return group === null || frame === null ? null : throughGroup(own, group, frame)
}

describe("a layer joins and leaves a plain group", () => {
  it("keeps a layer where it shows on the slide when it joins a scaled group, and the group fits its layers", () => {
    const turn = joined(indexed, a, g)
    if (turn === null) throw new Error("join")
    const after = ran(indexed, turn)
    expect(groupedNow(after, a)).toBe(true)
    expect(placeOf(after, a)?.box).toEqual({ x: -450, y: -450, cx: 100, cy: 50 })
    expect(rebased(after, g)?.frame).toEqual({ x: -450, y: -450, cx: 650, cy: 550 })
    expect(shownPlace(after, g)?.box).toEqual({ x: 100, y: 100, cx: 1300, cy: 1100 })
    expect(onSlide(after, a)?.box).toEqual({ x: 100, y: 100, cx: 200, cy: 100 })
    expect(onSlide(after, first)?.box).toEqual({ x: 1000, y: 1000, cx: 200, cy: 200 })
  })

  it("keeps every layer in place when the group is ungrouped after a join", () => {
    const turn = joined(indexed, a, g)
    if (turn === null) throw new Error("join")
    const after = ran(indexed, turn)
    const apart = ungroupTurn(after, file, slide, g)
    if (apart === null) throw new Error("ungroup")
    const ungrouped = ran(after, apart)
    expect(placeOf(ungrouped, a)?.box).toEqual({ x: 100, y: 100, cx: 200, cy: 100 })
    expect(placeOf(ungrouped, second)?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
  })

  it("puts a layer that leaves a group on the slide where it showed, and the group shrinks to the rest", () => {
    const turn = joined(indexed, first, null)
    if (turn === null) throw new Error("leave")
    const after = ran(indexed, turn)
    expect(groupedNow(after, first)).toBe(false)
    expect(placeOf(after, first)?.box).toEqual({ x: 1000, y: 1000, cx: 200, cy: 200 })
    expect(rebased(after, g)?.frame).toEqual({ x: 100, y: 0, cx: 100, cy: 100 })
    expect(shownPlace(after, g)?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
    expect(onSlide(after, second)?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
  })

  it("refuses to join a group into itself", () => {
    expect(joined(indexed, g, g)).toBeNull()
  })

  it("undoes a join in one step and puts the layer back where it was", () => {
    const turn = joined(indexed, a, g)
    if (turn === null) throw new Error("join")
    const after = ran(indexed, turn)
    const undoable: Undoable = {
      joined: a,
      slide,
      file,
      before: { frame: null, before: null, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      after: { frame: g, before: null, box: { x: 100, y: 100, cx: 200, cy: 100 } },
    }
    const back = undoOf(after, undoable)
    if (!back.ok) throw new Error("undo")
    const undone = ran(after, back.commands)
    expect(groupedNow(undone, a)).toBe(false)
    expect(placeOf(undone, a)?.box).toEqual({ x: 100, y: 100, cx: 200, cy: 100 })
    expect(onSlide(undone, first)?.box).toEqual({ x: 1000, y: 1000, cx: 200, cy: 200 })
  })
})
