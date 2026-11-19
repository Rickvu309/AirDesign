import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementGone,
  elementId,
  layoutNodes,
  openRegister,
  readLayout,
  slideId,
  ungroupTurn,
  type Command,
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const a = elementId("256.2")
const b = elementId("256.3")

const layout = { flow: "horizontal", gap: 50, padding: [0, 0, 0, 0], align: "topLeft" } as const

function filed(child: { x: number; y: number }): Register {
  const elements: readonly IndexElement[] = [
    {
      node: frame,
      kind: "group",
      value: null,
      box: { x: 1100, y: 1100, cx: 350, cy: 100 },
      grouped: false,
      frame: { x: 100, y: 100, cx: 350, cy: 100 },
      framing: { backdrop, children: [a, b], layout },
    },
    {
      node: backdrop,
      kind: "shape",
      value: null,
      box: { x: 100, y: 100, cx: 350, cy: 100 },
      grouped: true,
      group: frame,
    },
    { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: true, group: frame },
    { node: b, kind: "shape", value: "", box: { ...child, cx: 100, cy: 100 }, grouped: true, group: frame },
  ]
  return {
    ...openRegister("", ""),
    index: {
      total: elements.length,
      slides: [{ id: "256", position: 0, free: 30, animated: [] }],
      elements,
      pages: [{ once: "page", offset: 0, count: elements.length }],
    },
  }
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

describe("auto layout frame read from a file", () => {
  it("lays out a frame the file marks, in slide space when the group was moved in PowerPoint", () => {
    const register = filed({ x: 350, y: 100 })
    expect(layoutNodes(register)).toEqual([frame])
    const view = readLayout(register, frame)
    expect(view?.backdrop).toBe(backdrop)
    expect(view?.children).toEqual([
      { node: a, box: { x: 1100, y: 1100, cx: 200, cy: 100 } },
      { node: b, box: { x: 1350, y: 1100, cx: 100, cy: 100 } },
    ])
    const wider = ran(register, [{ command: "person", v: 13, patch: { layout: { gap: { set: 100 } } }, node: frame }])
    expect(readLayout(wider, frame)?.children[1]?.box.x).toBe(1400)
  })

  it("drops the frame's backdrop with it when the frame is ungrouped", () => {
    const register = filed({ x: 350, y: 100 })
    const turn = ungroupTurn(register, file, slide, frame)
    if (turn === null) throw new Error("ungroup")
    const after = ran(register, turn)
    expect(elementGone(after, backdrop)).toBe(true)
    expect(readLayout(after, frame)).toBeNull()
    expect(changeLayout(register, { remove: frame })).not.toBeNull()
  })
})
