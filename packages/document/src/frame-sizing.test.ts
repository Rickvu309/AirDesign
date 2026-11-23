import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  planChange,
  readLayout,
  registerScope,
  slideId,
  type Command,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const point = 12_700

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 0, y: 0, cx: 20 * point, cy: 10 * point }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 30 * point, y: 0, cx: 10 * point, cy: 20 * point }, grouped: false },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 30, animated: [] }],
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

function set(register: Register, node: ElementId, patch: ElementPatch): Register {
  return ran(register, [{ command: "person", v: 13, patch, node }])
}

function row(): Register {
  const changed = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return set(ran(indexed, [{ command: "slide", file, edit: changed.slide }]), frame, {
    layout: { gap: { set: 10 * point } },
  })
}

const places = (register: Register) => readLayout(register, frame)?.children.map((child) => [child.box.x, child.box.y])

describe("a frame's own width and height, Hug contents or Fixed", () => {
  it("hugs its children by default", () => {
    const view = readLayout(row(), frame)
    expect([view?.width, view?.height]).toEqual(["hug", "hug"])
    expect(view?.box).toEqual({ x: 0, y: 0, cx: 40 * point, cy: 20 * point })
  })

  it("keeps a fixed width and places the row along it by alignment", () => {
    const wide = set(row(), frame, { layout: { width: { set: "fixed" } }, box: { w: { set: 100 * point } } })
    expect(readLayout(wide, frame)?.box).toEqual({ x: 0, y: 0, cx: 100 * point, cy: 20 * point })
    expect(places(wide)).toEqual([
      [0, 0],
      [30 * point, 0],
    ])
    expect(places(set(wide, frame, { layout: { align: { set: "top" } } }))).toEqual([
      [30 * point, 0],
      [60 * point, 0],
    ])
    expect(places(set(wide, frame, { layout: { align: { set: "topRight" } } }))).toEqual([
      [60 * point, 0],
      [90 * point, 0],
    ])
  })

  it("keeps a fixed height and centres the row across it", () => {
    const tall = set(row(), frame, {
      layout: { height: { set: "fixed" }, align: { set: "left" } },
      box: { h: { set: 40 * point } },
    })
    expect(readLayout(tall, frame)?.box).toEqual({ x: 0, y: 0, cx: 40 * point, cy: 40 * point })
    expect(places(tall)).toEqual([
      [0, 15 * point],
      [30 * point, 10 * point],
    ])
  })

  it("places a fixed column along its height by alignment, inside its padding", () => {
    const column = set(row(), frame, {
      layout: {
        flow: { set: "vertical" },
        height: { set: "fixed" },
        align: { set: "bottomLeft" },
        padding: { set: { left: 0, top: 5 * point, right: 0, bottom: 5 * point } },
      },
      box: { h: { set: 100 * point } },
    })
    expect(places(column)).toEqual([
      [0, 55 * point],
      [0, 75 * point],
    ])
  })

  it("makes the side a person or agent sizes Fixed, and leaves a move alone", () => {
    const scope = registerScope(row())
    const sized = planChange({ target: { node: frame }, box: { w: 80 } }, scope)
    if (!sized.ok) throw new Error(JSON.stringify(sized.refusals))
    expect(sized.rows[0]?.row.patch).toMatchObject({ layout: { width: { set: "fixed" } } })
    expect(sized.rows[0]?.row.patch.layout?.height).toBeUndefined()
    const moved = planChange({ target: { node: frame }, box: { x: 50, y: 50 } }, scope)
    if (!moved.ok) throw new Error(JSON.stringify(moved.refusals))
    expect(moved.rows[0]?.row.patch.layout).toBeUndefined()
  })

  it("keeps the hugged size when a side is made Fixed, so the children stay where they are", () => {
    const grown = set(row(), a, { box: { w: { set: 50 * point } } })
    const scope = registerScope(grown)
    const pinned = planChange({ target: { node: frame }, layout: { width: "fixed" } }, scope)
    if (!pinned.ok) throw new Error(JSON.stringify(pinned.refusals))
    expect(pinned.rows[0]?.row.patch).toMatchObject({ box: { w: { set: 70 * point } } })
    expect(pinned.rows[0]?.row.patch.box?.h).toBeUndefined()
    const fixed = set(grown, frame, pinned.rows[0]!.row.patch)
    expect(readLayout(fixed, frame)?.box).toEqual(readLayout(grown, frame)?.box)
    expect(places(fixed)).toEqual(places(grown))
  })
})
