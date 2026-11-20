import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  planChange,
  readLayout,
  registerScope,
  placedByFrame,
  resizedSides,
  slideId,
  takes,
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
const c = elementId("256.4")
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const point = 12_700

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 0, y: 0, cx: 20 * point, cy: 10 * point }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 30 * point, y: 0, cx: 10 * point, cy: 20 * point }, grouped: false },
  { node: c, kind: "shape", value: "", box: { x: 50 * point, y: 0, cx: 10 * point, cy: 10 * point }, grouped: false },
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

function row(wrap: readonly ElementId[] = [a, b]): Register {
  const changed = changeLayout(indexed, { wrap, slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return set(ran(indexed, [{ command: "slide", file, edit: changed.slide }]), frame, {
    layout: { gap: { set: 10 * point } },
  })
}

function fixed(register: Register, cx: number, cy?: number): Register {
  return set(register, frame, {
    layout: { width: { set: "fixed" }, ...(cy === undefined ? {} : { height: { set: "fixed" } }) },
    box: { w: { set: cx }, ...(cy === undefined ? {} : { h: { set: cy } }) },
  })
}

const laid = (register: Register) =>
  new Map(readLayout(register, frame)?.children.map((child) => [child.node, child.box]))

describe("a layer that fills its auto layout frame", () => {
  it("takes the free length of a fixed row after the other layers and the gaps", () => {
    const filled = set(fixed(row(), 100 * point), b, { layout: { width: { set: "fill" } } })
    expect(laid(filled).get(a)).toEqual({ x: 0, y: 0, cx: 20 * point, cy: 10 * point })
    expect(laid(filled).get(b)).toEqual({ x: 30 * point, y: 0, cx: 70 * point, cy: 20 * point })
    expect(readLayout(filled, frame)?.box.cx).toBe(100 * point)
  })

  it("shares the free length equally among the layers that fill", () => {
    const wide = fixed(row([a, b, c]), 130 * point)
    const filled = set(set(wide, b, { layout: { width: { set: "fill" } } }), c, { layout: { width: { set: "fill" } } })
    expect(laid(filled).get(b)).toMatchObject({ x: 30 * point, cx: 45 * point })
    expect(laid(filled).get(c)).toMatchObject({ x: 85 * point, cx: 45 * point })
  })

  it("takes the frame's inner thickness across, inside its padding", () => {
    const tall = set(fixed(row(), 100 * point, 40 * point), frame, {
      layout: { padding: { set: { left: 0, top: 5 * point, right: 0, bottom: 5 * point } } },
    })
    const filled = set(tall, a, { layout: { height: { set: "fill" } } })
    expect(laid(filled).get(a)).toMatchObject({ y: 5 * point, cy: 30 * point })
  })

  it("keeps its own size along a side the frame hugs", () => {
    const hugging = set(row(), b, { layout: { width: { set: "fill" } } })
    expect(laid(hugging).get(b)).toEqual(laid(row()).get(b))
  })

  it("makes a side of the frame Fixed at its size when a layer fills it, as Figma does", () => {
    const hugging = row()
    const scope = registerScope(hugging)
    const planned = planChange({ target: { node: b }, layout: { width: "fill" } }, scope)
    if (!planned.ok) throw new Error(JSON.stringify(planned.refusals))
    const byNode = new Map(planned.rows.map((each) => [each.node, each.row.patch]))
    expect(byNode.get(b)).toEqual({ layout: { width: { set: "fill" } } })
    expect(byNode.get(frame)).toEqual({ layout: { width: { set: "fixed" } }, box: { w: { set: 40 * point } } })
    const fixedNow = planChange(
      { target: { node: b }, layout: { width: "fill" } },
      registerScope(fixed(hugging, 100 * point)),
    )
    if (!fixedNow.ok) throw new Error(JSON.stringify(fixedNow.refusals))
    expect(fixedNow.rows.map((each) => each.node)).toEqual([b])
  })

  it("lets a layer in the frame take Width and Height, and not the frame's backdrop", () => {
    const framed = row()
    const taken = (node: ElementId) => {
      const facts = registerScope(framed).view(node)?.facts
      return facts === undefined ? [] : takes(facts).filter((field) => field.startsWith("layout."))
    }
    expect(taken(b)).toEqual(["layout.width", "layout.height"])
    expect(taken(backdrop)).toEqual([])
    expect(taken(frame)).toContain("layout.flow")
  })

  it("makes a filling side of a layer Fixed when its handle resizes it, and leaves a Fixed layer's sides alone", () => {
    const filled = set(fixed(row(), 100 * point), b, { layout: { width: { set: "fill" } } })
    expect(resizedSides(filled, b, { cx: 50 * point, cy: 20 * point })).toEqual({
      before: { width: "fill" },
      after: { width: "fixed" },
    })
    expect(resizedSides(filled, b, { cx: 70 * point, cy: 20 * point })).toBeNull()
    expect(resizedSides(filled, a, { cx: 30 * point, cy: 10 * point })).toBeNull()
  })

  it("lets a layer's handle write only its size, which the frame lays out", () => {
    const framed = row()
    expect(placedByFrame(framed, a)).toBe(true)
    expect(placedByFrame(framed, backdrop)).toBe(false)
    expect(placedByFrame(indexed, a)).toBe(false)
  })
})
