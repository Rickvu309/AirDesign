import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  measureDue,
  measureOwed,
  measureStale,
  openRegister,
  slideId,
  type Command,
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
  { node: a, kind: "shape", value: "Top", box: { x: 100, y: 100, cx: 2000, cy: 300 }, grouped: false },
  { node: b, kind: "shape", value: "Next", box: { x: 100, y: 500, cx: 2000, cy: 300 }, grouped: false },
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
    const node = "node" in command ? command.node : undefined
    if (node !== undefined && command.command !== "slide" && !current.nodes.includes(node)) {
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

function column(): Register {
  const changed = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return ran(indexed, [
    { command: "slide", file, edit: changed.slide },
    { command: "start", node: a, runId: "run" },
    { command: "start", node: b, runId: "run" },
  ])
}

const agent = (node: typeof a, patch: Record<string, unknown>): Command =>
  ({ command: "agent", node, runId: "run", readAt: 0, v: 13, patch }) as Command

const measured = (node: typeof a, h: number): Command => ({
  command: "person",
  node,
  v: 13,
  patch: { box: { h: { set: h } } },
})

describe("a measure an agent's edit owes", () => {
  it("is owed for a child of an auto layout frame whose text an agent changed after its last measured height", () => {
    const typed = ran(column(), [agent(a, { text: { value: { set: "Top\nand a much longer line" } } })])
    expect(measureOwed(typed)).toEqual([a])
    expect(measureOwed(ran(typed, [measured(a, 600)]))).toEqual([])
    expect(measureOwed(ran(typed, [measured(a, 300)]))).toEqual([])
  })

  it("is not owed for a person's typing, a fill, or a shape outside any frame", () => {
    const register = column()
    expect(measureOwed(register)).toEqual([])
    const typed = ran(register, [{ command: "person", node: a, v: 13, patch: { text: { value: { set: "x" } } } }])
    expect(measureOwed(typed)).toEqual([])
    expect(measureStale(typed)).toEqual([a])
    expect(measureOwed(ran(register, [agent(b, { fills: { p0: { set: { solid: { rgb: "FF0000" } } } } })]))).toEqual([])
  })

  it("is owed again when the agent edits the text after the device measured it", () => {
    const register = ran(column(), [
      agent(b, { body: { autofit: { set: "shape" } } }),
      measured(b, 300),
      agent(b, { box: { w: { set: 1000 } } }),
    ])
    expect(measureOwed(register)).toEqual([b])
  })

  it("lands the device's measured height without guarding the element from the agent's run", () => {
    const register = ran(column(), [agent(a, { text: { value: { set: "Longer" } } }), measured(a, 600)])
    expect(register.elements[a]?.guarded).toBe(false)
    expect(ran(register, [agent(a, { text: { value: { set: "Longer still" } } })]).elements[a]?.landed).toHaveLength(3)
    const resized = ran(column(), [
      {
        command: "person",
        node: a,
        v: 13,
        patch: { box: { x: { set: 100 }, y: { set: 100 }, w: { set: 900 }, h: { set: 600 } } },
      },
    ])
    expect(resized.elements[a]?.guarded).toBe(true)
  })

  it("is due, so the device keeps the height to the text both ways, once anyone edited a child's text, even after an undo hid it", () => {
    const register = column()
    expect(measureDue(register)).toEqual([])
    const typed = ran(register, [agent(a, { text: { value: { set: "Longer" } } }), measured(a, 600)])
    expect(measureDue(typed)).toEqual([a])
    expect(measureDue(ran(typed, [{ command: "undo", node: a, runId: "run" }]))).toEqual([a])
    expect(measureOwed(ran(typed, [{ command: "undo", node: a, runId: "run" }]))).toEqual([])
  })
})
