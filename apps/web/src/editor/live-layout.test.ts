import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  type Command,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { relaidBoxes } from "./live-layout"

const slide = slideId("256")
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

const set = (register: Register, node: ElementId, patch: ElementPatch) =>
  ran(register, [{ command: "person", v: 13, patch, node }])

function row(): Register {
  const changed = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  const framed = ran(indexed, [{ command: "slide", file: [slide], edit: changed.slide }])
  return set(framed, frame, { layout: { gap: { set: 10 * point } } })
}

const widened = (cx: number) => ({
  box: { x: 0, y: 0, cx, cy: 20 * point },
  element: { id: frame, file: "" },
  sides: { before: { width: "hug" as const }, after: { width: "fixed" as const } },
})

describe("the live layout of an auto layout frame while a side handle resizes it", () => {
  it("lays a filling layer at the frame's new free width, and the backdrop at the frame's size", () => {
    const filled = set(row(), b, { layout: { width: { set: "fill" } } })
    const laid = relaidBoxes(filled, [widened(100 * point)])
    expect(laid?.get(b)).toEqual({ x: 30 * point, y: 0, cx: 70 * point, cy: 20 * point })
    expect(laid?.get(backdrop)).toEqual({ x: 0, y: 0, cx: 100 * point, cy: 20 * point })
    expect(laid?.get(a)).toEqual({ x: 0, y: 0, cx: 20 * point, cy: 10 * point })
  })

  it("moves a fixed layer by Alignment as the frame grows", () => {
    const centred = set(row(), frame, { layout: { align: { set: "top" } } })
    expect(relaidBoxes(centred, [widened(100 * point)])?.get(a)).toMatchObject({ x: 30 * point })
  })

  it("lays nothing for a layer outside an auto layout frame", () => {
    const loose = { box: { x: 0, y: 0, cx: 50 * point, cy: 10 * point }, element: { id: a, file: "" } }
    expect(relaidBoxes(indexed, [loose])).toBeNull()
  })
})
