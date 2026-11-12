import { describe, expect, it } from "vitest"
import {
  decide,
  elementGone,
  elementId,
  nextElementId,
  openingTable,
  openRegister,
  openingElement,
  readSlideState,
  slideId,
  type IndexElement,
  type Register,
  type SlideCommand,
  writeTableValue,
} from "./index.js"

const file = [slideId("256"), slideId("257")]
const node = elementId("256.9")
const box = { x: 0, y: 0, cx: 100, cy: 50 }
const textBox: IndexElement = { node, kind: "shape", value: "", box, grouped: false }

function slide(register: Register, edit: SlideCommand) {
  return decide(register, { command: "slide", file, edit })
}

function applied(register: Register, edit: SlideCommand): Register {
  const decision = slide(register, edit)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: 3,
    slides: [
      { id: "256", position: 0 },
      { id: "257", position: 1 },
    ],
    elements: [
      { node: elementId("256.2"), kind: "shape", value: "Title", box, grouped: false },
      { node: elementId("256.4"), kind: "group", value: null, box, grouped: false },
      { node: elementId("256.5"), kind: "shape", value: "Inside", box, grouped: true },
    ],
    pages: [{ once: "page", offset: 0, count: 3 }],
  },
}

describe("element order", () => {
  it("opens an added text box with its box and empty text, and a person types in it", () => {
    const added = applied(openRegister("", ""), { slide: "element-add", id: file[0]!, element: textBox })
    expect(openingElement(added, node)).toEqual(textBox)
    const typed = decide(added, { command: "add", node, floor: "", route: "" })
    if (typed.decision !== "apply") throw new Error(typed.code)
    expect(decide(typed.register, { command: "person", value: "Hello", node }).decision).toBe("apply")
  })

  it("refuses every later edit, start and add of a removed element, and its id is never handed out again", () => {
    const added = applied(openRegister("", ""), { slide: "element-add", id: file[0]!, element: textBox })
    const opened = decide(added, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    const removed = applied(opened.register, { slide: "element-remove", id: file[0]!, node })
    expect(elementGone(removed, node)).toBe(true)
    expect(decide(removed, { command: "person", value: "Late", node })).toEqual({ decision: "refuse", code: "dead" })
    expect(decide(removed, { command: "start", runId: "r", node })).toEqual({ decision: "refuse", code: "dead" })
    expect(slide(removed, { slide: "element-remove", id: file[0]!, node })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    expect(slide(removed, { slide: "element-add", id: file[0]!, element: textBox })).toEqual({
      decision: "refuse",
      code: "present",
    })
    expect(nextElementId(removed, file[0]!, 3)).toBe("256.10")
    expect(nextElementId(removed, file[1]!, 3)).toBe("257.3")
  })

  it("restores a removed element with its text, takes edits again, and refuses a restore of an element that shows", () => {
    const added = applied(openRegister("", ""), { slide: "element-add", id: file[0]!, element: textBox })
    const opened = decide(added, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    const typed = decide(opened.register, { command: "person", value: "Hello", node })
    if (typed.decision !== "apply") throw new Error(typed.code)
    expect(slide(typed.register, { slide: "element-restore", id: file[0]!, node })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    const removed = applied(typed.register, { slide: "element-remove", id: file[0]!, node })
    const restored = applied(removed, { slide: "element-restore", id: file[0]!, node })
    expect(elementGone(restored, node)).toBe(false)
    expect(restored.elements[node]?.landed.at(-1)?.value).toBe("Hello")
    expect(decide(restored, { command: "person", value: "Again", node }).decision).toBe("apply")
    expect(nextElementId(restored, file[0]!, 3)).toBe("256.10")
    expect(elementGone(applied(restored, { slide: "element-remove", id: file[0]!, node }), node)).toBe(true)
  })

  it("refuses a restore on a removed slide or of an element off its slide", () => {
    const indexedRemoved = applied(indexed, { slide: "element-remove", id: file[0]!, node: elementId("256.2") })
    expect(slide(indexedRemoved, { slide: "element-restore", id: file[1]!, node: elementId("256.2") })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    const gone = applied(indexedRemoved, { slide: "remove", id: file[0]! })
    expect(slide(gone, { slide: "element-restore", id: file[0]!, node: elementId("256.2") })).toEqual({
      decision: "refuse",
      code: "dead",
    })
  })

  it("refuses a text box that names another slide, a known id, text, a group or no box", () => {
    const refused = (element: IndexElement, id = file[0]!) =>
      slide(indexed, { slide: "element-add", id, element }).decision === "refuse"
    expect(refused(textBox, file[1]!)).toBe(true)
    expect(refused({ ...textBox, node: elementId("256.2") })).toBe(true)
    expect(refused({ ...textBox, value: "Text" })).toBe(true)
    expect(refused({ ...textBox, grouped: true })).toBe(true)
    expect(refused({ ...textBox, kind: "picture" })).toBe(true)
    expect(refused({ ...textBox, box: null })).toBe(true)
    expect(refused(textBox)).toBe(false)
  })

  it("opens an added table with its box and empty rows, and refuses one with text, no box or rows it does not own", () => {
    const table: IndexElement = { ...textBox, kind: "table", value: writeTableValue(openingTable(3, 3)) }
    const added = applied(openRegister("", ""), { slide: "element-add", id: file[0]!, element: table })
    expect(openingElement(added, node)).toEqual(table)
    const refused = (element: IndexElement) =>
      slide(indexed, { slide: "element-add", id: file[0]!, element }).decision === "refuse"
    expect(refused(table)).toBe(false)
    expect(refused({ ...table, value: "" })).toBe(true)
    expect(refused({ ...table, box: null })).toBe(true)
    expect(refused({ ...table, grouped: true })).toBe(true)
    const typed = writeTableValue({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: -1, text: "x" }] }]] }] })
    expect(refused({ ...table, value: typed })).toBe(true)
    expect(
      refused({ ...table, value: writeTableValue({ rows: [{ from: -1, cells: [[{ from: 0, runs: [] }]] }] }) }),
    ).toBe(true)
    expect(refused({ ...textBox, value: writeTableValue(openingTable(1, 1)) })).toBe(true)
  })

  it("removes an indexed element but refuses a group, a grouped element and an element the index lacks", () => {
    const remove = (id: string) => slide(indexed, { slide: "element-remove", id: file[0]!, node: elementId(id) })
    expect(remove("256.2").decision).toBe("apply")
    expect(remove("256.4")).toEqual({ decision: "refuse", code: "group-box" })
    expect(remove("256.5")).toEqual({ decision: "refuse", code: "group-box" })
    expect(remove("256.7")).toEqual({ decision: "refuse", code: "dead" })
  })

  it("refuses to remove an element the index marks animated, and removes one it does not", () => {
    const marked: Register = {
      ...indexed,
      index: {
        ...indexed.index!,
        slides: [
          { id: "256", position: 0, size: { width: 9, height: 9 }, free: 8, animated: ["2"] },
          { id: "257", position: 1 },
        ],
      },
    }
    const remove = (id: string) => slide(marked, { slide: "element-remove", id: file[0]!, node: elementId(id) })
    expect(remove("256.2")).toEqual({ decision: "refuse", code: "locked" })
    expect(remove("256.5")).toEqual({ decision: "refuse", code: "group-box" })
    expect(slide(indexed, { slide: "element-remove", id: file[0]!, node: elementId("256.2") }).decision).toBe("apply")
  })

  it("refuses an element command on a removed slide", () => {
    const gone = applied(openRegister("", ""), { slide: "remove", id: file[1]! })
    const element = { ...textBox, node: elementId("257.9") }
    expect(slide(gone, { slide: "element-add", id: file[1]!, element })).toEqual({ decision: "refuse", code: "dead" })
  })

  it("reads element commands back from stored rows and refuses an element off its slide", () => {
    const order = [
      { slide: "element-add", id: "256", element: textBox },
      { slide: "element-remove", id: "256", node: "256.9" },
      { slide: "element-restore", id: "256", node: "256.9" },
    ]
    expect(readSlideState({ file, order })?.order).toEqual(order)
    expect(readSlideState({ file, order: [{ ...order[1], node: "257.9" }] })).toBeUndefined()
    expect(readSlideState({ file, order: [{ ...order[0], element: { ...textBox, node: "257.9" } }] })).toBeUndefined()
  })
})
