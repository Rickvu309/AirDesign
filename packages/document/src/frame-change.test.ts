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
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const frame = elementId("256.20")
const backdrop = elementId("256.21")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 120, cx: 100, cy: 100 }, grouped: false },
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

function wrapped(flow: "horizontal" | "none"): Register {
  const changed = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  const decision = decide(indexed, { command: "slide", file, edit: changed.slide })
  if (decision.decision !== "apply") throw new Error(decision.code)
  if (flow === "horizontal") return decision.register
  const opened = decide(decision.register, { command: "add", node: frame, floor: "", route: "" })
  if (opened.decision !== "apply") throw new Error(opened.code)
  const freed = decide(opened.register, {
    command: "person",
    v: 13,
    node: frame,
    patch: { layout: { flow: { set: "none" } } },
  })
  if (freed.decision !== "apply") throw new Error(freed.code)
  return freed.register
}

describe("a change aimed at a frame", () => {
  it("paints fill, border, corners and opacity on the backdrop and keeps the rest on the frame", () => {
    const plan = planChange(
      { target: { node: frame }, fills: { paint: { solid: { rgb: "C00000" } } }, layout: { gap: 10 } },
      registerScope(wrapped("horizontal")),
    )
    expect(plan.ok && plan.rows.map((row) => [row.node, Object.keys(row.row.patch)])).toEqual([
      [frame, ["layout"]],
      [backdrop, ["fills"]],
    ])
  })

  it("reads a child of a frame without auto layout where it shows and stores its move from the frame's corner", () => {
    const register = wrapped("none")
    const origin = readLayout(register, frame)?.box
    const scope = registerScope(register)
    expect(scope.view(b)?.box).toEqual(readLayout(register, frame)?.children.find((child) => child.node === b)?.box)
    const plan = planChange({ target: { node: b }, box: { x: 1000, y: 500 } }, scope)
    expect(plan.ok && plan.rows[0]?.row.patch.box).toMatchObject({
      x: { set: 1000 - (origin?.x ?? 0) },
      y: { set: 500 - (origin?.y ?? 0) },
    })
  })
})
