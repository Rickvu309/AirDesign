import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  type Command,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { framedOf, storedBox } from "@/frame-boxes"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const frame = elementId("256.20")
const backdrop = elementId("256.21")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 100, cx: 100, cy: 100 }, grouped: false },
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

it("stores a dragged child of a frame without auto layout relative to the frame, and any other box as it is", () => {
  const wrapped = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
  if (wrapped === null || !("slide" in wrapped)) throw new Error("wrap")
  const auto = ran(indexed, [{ command: "slide", file, edit: wrapped.slide }])
  expect(framedOf(auto).frames.get(frame)).toBe("auto")
  expect(storedBox(auto, b, { x: 500, y: 300, cx: 100, cy: 100 })).toEqual({ x: 500, y: 300, cx: 100, cy: 100 })
  const removed = changeLayout(auto, { remove: frame })
  if (removed === null || !("rows" in removed)) throw new Error("remove")
  const free = ran(
    auto,
    removed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
  )
  expect(framedOf(free).frames.get(frame)).toBe("free")
  expect(storedBox(free, b, { x: 500, y: 300, cx: 100, cy: 100 })).toEqual({ x: 400, y: 200, cx: 100, cy: 100 })
  expect(storedBox(free, frame, { x: 500, y: 300, cx: 1, cy: 1 })).toEqual({ x: 500, y: 300, cx: 1, cy: 1 })
  expect(storedBox(null, b, { x: 1, y: 2, cx: 3, cy: 4 })).toEqual({ x: 1, y: 2, cx: 3, cy: 4 })
})
