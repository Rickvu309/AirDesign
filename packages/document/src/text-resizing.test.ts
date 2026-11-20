import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  hugsText,
  measureOwed,
  measureStale,
  openRegister,
  slideId,
  textOpening,
  type Command,
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const made = elementId("256.2")
const imported = elementId("256.3")

const index: Register = {
  ...openRegister("", ""),
  index: {
    total: 1,
    slides: [{ id: "256", position: 0, free: 20, animated: [] }],
    elements: [{ node: imported, kind: "shape", value: "Kept", box: { x: 0, y: 0, cx: 900, cy: 300 }, grouped: false }],
    pages: [{ once: "page", offset: 0, count: 1 }],
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

function added(resizing: Parameters<typeof textOpening>[0]): Register {
  const element: IndexElement = {
    node: made,
    kind: "shape",
    value: "",
    box: { x: 100, y: 100, cx: 300, cy: 300 },
    grouped: false,
    opening: textOpening(resizing),
  }
  return ran(index, [
    { command: "slide", file, edit: { slide: "element-add", id: slide, element, runId: "run" } },
    { command: "start", node: made, runId: "run" },
  ])
}

const person = (node: typeof made, patch: Record<string, unknown>): Command =>
  ({ command: "person", node, v: 13, patch }) as Command

const agent = (node: typeof made, patch: Record<string, unknown>): Command =>
  ({ command: "agent", node, runId: "run", readAt: 0, v: 13, patch }) as Command

describe("the text resizing a new text layer opens with", () => {
  it("has no inset, written as zero on every side, and maps auto width, auto height and fixed size to PowerPoint's wrap and autofit", () => {
    const flush = { set: { left: 0, top: 0, right: 0, bottom: 0 } }
    expect(textOpening("auto-width")).toEqual({
      body: { insets: flush, wrap: { set: false }, autofit: { set: "grow" } },
    })
    expect(textOpening("auto-height")).toEqual({
      body: { insets: flush, wrap: { set: true }, autofit: { set: "grow" } },
    })
    expect(textOpening("fixed")).toEqual({ body: { insets: flush, wrap: { set: true }, autofit: { set: "none" } } })
  })
})

describe("a text layer that hugs its text", () => {
  it("hugs while its autofit is grow, from its opening or from a later row, and not once a row sets another autofit", () => {
    expect(hugsText(added("auto-width"), made)).toBe(true)
    expect(hugsText(added("auto-height"), made)).toBe(true)
    expect(hugsText(added("fixed"), made)).toBe(false)
    expect(hugsText(ran(added("fixed"), [person(made, { body: { autofit: { set: "grow" } } })]), made)).toBe(true)
    expect(hugsText(ran(added("auto-width"), [person(made, { body: { autofit: { set: "none" } } })]), made)).toBe(false)
    expect(hugsText(index, imported)).toBe(false)
  })

  it("owes the device a measure once its text changed after its last measured size, for a person or an agent", () => {
    const typed = ran(added("auto-width"), [person(made, { text: { value: { set: "Hello" } } })])
    expect(measureStale(typed)).toEqual([made])
    expect(measureOwed(typed)).toEqual([])
    const measured = ran(typed, [person(made, { box: { w: { set: 600 }, h: { set: 200 } } })])
    expect(measureStale(measured)).toEqual([])
    const agentTyped = ran(added("auto-height"), [agent(made, { text: { value: { set: "Hello" } } })])
    expect(measureOwed(agentTyped)).toEqual([made])
    expect(measureStale(ran(added("fixed"), [person(made, { text: { value: { set: "Hello" } } })]))).toEqual([])
  })

  it("lands the device's measured width and height without guarding the layer from the agent's run", () => {
    const typed = ran(added("auto-width"), [agent(made, { text: { value: { set: "Longer" } } })])
    const measured = ran(typed, [person(made, { box: { w: { set: 600 }, h: { set: 200 } } })])
    expect(measured.elements[made]?.guarded).toBe(false)
    const resized = ran(typed, [
      person(made, { box: { x: { set: 100 }, y: { set: 100 }, w: { set: 900 }, h: { set: 600 } } }),
    ])
    expect(resized.elements[made]?.guarded).toBe(true)
    expect(ran(typed, [person(made, { box: { w: { set: 900 } } })]).elements[made]?.guarded).toBe(true)
  })
})
