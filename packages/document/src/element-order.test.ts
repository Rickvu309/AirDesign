import { describe, expect, it } from "vitest"
import {
  decide,
  elementGone,
  elementId,
  elementStacks,
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
    expect(refused({ ...textBox, value: null })).toBe(true)
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

  it("opens an added rectangle, ellipse and line with their geometry, and refuses one with text, media or the wrong kind", () => {
    const shape: IndexElement = { ...textBox, value: null }
    const line: IndexElement = { ...shape, kind: "connector", box: { ...box, cy: 0 } }
    const add = (element: IndexElement, geometry: unknown) =>
      ({ slide: "element-add", id: file[0]!, element, geometry }) as SlideCommand
    for (const [element, geometry] of [
      [shape, "rect"],
      [shape, "ellipse"],
      [line, "line"],
      [shape, "star5"],
      [line, "straightConnector1"],
    ] as const) {
      const added = applied(openRegister("", ""), add(element, geometry))
      expect(openingElement(added, node)).toEqual(element)
      expect(added.order.at(-1)).toEqual({ slide: "element-add", id: file[0]!, element, geometry })
    }
    const refused = (command: SlideCommand) => slide(indexed, command).decision === "refuse"
    expect(refused(add(shape, "rect"))).toBe(false)
    expect(refused(add({ ...shape, value: "" }, "rect"))).toBe(true)
    expect(refused(add({ ...shape, value: "Text" }, "ellipse"))).toBe(true)
    expect(refused(add(line, "rect"))).toBe(true)
    expect(refused(add(shape, "line"))).toBe(true)
    expect(refused(add(shape, "straightConnector1"))).toBe(true)
    expect(refused(add(line, "star5"))).toBe(true)
    expect(refused(add({ ...shape, kind: "table" }, "rect"))).toBe(true)
    expect(refused(add({ ...shape, box: { ...box, cx: 0 } }, "rect"))).toBe(true)
    expect(refused(add({ ...line, box: { ...box, cx: 0, cy: 0 } }, "line"))).toBe(true)
    expect(refused(add(shape, "star"))).toBe(true)
    const media = { sha256: "d".repeat(64), type: "image/png" as const }
    expect(refused({ ...add(shape, "rect"), media } as SlideCommand)).toBe(true)
    expect(refused({ slide: "element-add", id: file[0]!, element: shape })).toBe(true)
  })

  it("reads an added shape's geometry back from a stored row and refuses one it does not know", () => {
    const shape = { ...textBox, value: null }
    const row = { slide: "element-add", id: "256", element: shape, geometry: "ellipse" }
    expect(readSlideState({ file, order: [row] })?.order).toEqual([row])
    expect(readSlideState({ file, order: [{ ...row, geometry: "star" }] })).toBeUndefined()
  })

  it("removes an indexed element and a group, but refuses a grouped element and an element the index lacks", () => {
    const remove = (id: string) => slide(indexed, { slide: "element-remove", id: file[0]!, node: elementId(id) })
    expect(remove("256.2").decision).toBe("apply")
    expect(remove("256.4").decision).toBe("apply")
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

  describe("a group's delete, as Figma removes a node with all its children", () => {
    const nested: Register = {
      ...openRegister("", ""),
      index: {
        total: 5,
        slides: [
          { id: "256", position: 0, size: { width: 9, height: 9 }, free: 8 },
          { id: "257", position: 1 },
        ],
        elements: [
          { node: elementId("256.2"), kind: "shape", value: "Title", box, grouped: false },
          { node: elementId("256.4"), kind: "group", value: null, box, grouped: false },
          { node: elementId("256.5"), kind: "shape", value: "Cell", box, grouped: true, group: elementId("256.4") },
          { node: elementId("256.6"), kind: "group", value: null, box, grouped: true, group: elementId("256.4") },
          { node: elementId("256.7"), kind: "shape", value: "Label", box, grouped: true, group: elementId("256.6") },
        ],
        pages: [{ once: "page", offset: 0, count: 5 }],
      },
    }
    const remove = { slide: "element-remove", id: file[0]!, node: elementId("256.4") } as const

    it("takes every layer inside the group with it, and its restore brings them all back", () => {
      const removed = applied(nested, remove)
      for (const each of ["256.4", "256.5", "256.6", "256.7"]) expect(elementGone(removed, elementId(each))).toBe(true)
      expect(elementGone(removed, elementId("256.2"))).toBe(false)
      const opened = decide(removed, { command: "add", node: elementId("256.7"), floor: "Label", route: "" })
      if (opened.decision !== "apply") throw new Error(opened.code)
      const typed = decide(opened.register, { command: "person", node: elementId("256.7"), value: "Typed" })
      expect(typed).toEqual({ decision: "refuse", code: "dead" })
      const restored = applied(removed, { slide: "element-restore", id: file[0]!, node: elementId("256.4") })
      for (const each of ["256.4", "256.5", "256.6", "256.7"])
        expect(elementGone(restored, elementId(each))).toBe(false)
    })

    it("refuses a group that holds an animated layer, and still refuses a layer inside a group", () => {
      const animated: Register = {
        ...nested,
        index: {
          ...nested.index!,
          slides: [
            { id: "256", position: 0, size: { width: 9, height: 9 }, free: 8, animated: ["7"] },
            { id: "257", position: 1 },
          ],
        },
      }
      expect(slide(animated, remove)).toEqual({ decision: "refuse", code: "locked" })
      expect(slide(nested, { ...remove, node: elementId("256.6") })).toEqual({ decision: "refuse", code: "group-box" })
    })
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

  it("reads a stacking order and brings the element to the front without hiding it", () => {
    const row = { slide: "element-order", id: "256", node: "256.2", before: null, among: ["256.2", "256.4"] }
    const read = readSlideState({ file, order: [row] })
    expect(read?.order).toEqual([
      {
        slide: "element-order",
        id: slideId("256"),
        node: elementId("256.2"),
        before: null,
        among: [elementId("256.2"), elementId("256.4")],
      },
    ])
    const brought = applied(indexed, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.2"),
      before: null,
      among: [elementId("256.2"), elementId("256.4")],
    })
    expect(elementGone(brought, elementId("256.2"))).toBe(false)
    expect(elementStacks(brought)).toEqual([{ slide: file[0]!, ids: [elementId("256.4"), elementId("256.2")] }])
  })

  it("refuses a stack move that changes nothing, names itself, leaves its list, or names a missing element", () => {
    const order = (node: string, before: string | null, among: readonly string[]) =>
      slide(indexed, {
        slide: "element-order",
        id: file[0]!,
        node: elementId(node),
        before: before === null ? null : elementId(before),
        among: among.map((id) => elementId(id)),
      })
    expect(order("256.2", null, ["256.4", "256.2"])).toEqual({ decision: "refuse", code: "dead" })
    expect(order("256.2", "256.2", ["256.2", "256.4"])).toEqual({ decision: "refuse", code: "dead" })
    expect(order("256.2", "256.5", ["256.2", "256.4"])).toEqual({ decision: "refuse", code: "dead" })
    expect(order("256.7", null, ["256.7", "256.2"])).toEqual({ decision: "refuse", code: "dead" })
    expect(order("256.2", null, ["256.2", "256.2"])).toEqual({ decision: "refuse", code: "dead" })
    expect(
      readSlideState({
        file,
        order: [{ slide: "element-order", id: "256", node: "257.2", before: null, among: ["257.2"] }],
      }),
    ).toBeUndefined()
  })

  it("refuses a stale sibling list and accepts the list the earlier move left", () => {
    const front = applied(indexed, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.2"),
      before: null,
      among: [elementId("256.2"), elementId("256.4")],
    })
    const stale = slide(front, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.4"),
      before: null,
      among: [elementId("256.2"), elementId("256.4")],
    })
    expect(stale).toEqual({ decision: "refuse", code: "stale" })
    const again = applied(front, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.4"),
      before: null,
      among: [elementId("256.4"), elementId("256.2")],
    })
    expect(elementStacks(again)).toEqual([{ slide: file[0]!, ids: [elementId("256.2"), elementId("256.4")] }])
  })

  it("appends a new shape to a slide-level stack and leaves a group stack as it was", () => {
    const grouped: Register = {
      ...indexed,
      index: {
        ...indexed.index!,
        total: 4,
        elements: [
          ...indexed.index!.elements,
          { node: elementId("256.6"), kind: "shape", value: "Also", box, grouped: true },
        ],
        pages: [{ once: "page", offset: 0, count: 4 }],
      },
    }
    const slideLevel = applied(grouped, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.2"),
      before: null,
      among: [elementId("256.2"), elementId("256.4")],
    })
    const inside = applied(slideLevel, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.5"),
      before: null,
      among: [elementId("256.5"), elementId("256.6")],
    })
    const added = applied(inside, { slide: "element-add", id: file[0]!, element: textBox })
    expect(elementStacks(added)).toEqual([
      { slide: file[0]!, ids: [elementId("256.4"), elementId("256.2"), elementId("256.9")] },
      { slide: file[0]!, ids: [elementId("256.6"), elementId("256.5")] },
    ])
    expect(
      slide(added, {
        slide: "element-order",
        id: file[0]!,
        node: elementId("256.5"),
        before: elementId("256.6"),
        among: [elementId("256.6"), elementId("256.5")],
      }).decision,
    ).toBe("apply")
  })

  it("drops a removed sibling and puts it back in front of the one it sat before", () => {
    const added = applied(indexed, { slide: "element-add", id: file[0]!, element: textBox })
    const brought = applied(added, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.2"),
      before: null,
      among: [elementId("256.2"), elementId("256.4"), elementId("256.9")],
    })
    const removed = applied(brought, { slide: "element-remove", id: file[0]!, node: elementId("256.9") })
    expect(elementStacks(removed)).toEqual([{ slide: file[0]!, ids: [elementId("256.4"), elementId("256.2")] }])
    const restored = applied(removed, { slide: "element-restore", id: file[0]!, node: elementId("256.9") })
    expect(elementStacks(restored)).toEqual([
      { slide: file[0]!, ids: [elementId("256.4"), elementId("256.9"), elementId("256.2")] },
    ])
  })

  it("reorders a group and an animated shape", () => {
    const marked: Register = {
      ...indexed,
      index: {
        ...indexed.index!,
        slides: [
          { id: "256", position: 0, animated: ["2", "4"] },
          { id: "257", position: 1 },
        ],
      },
    }
    expect(
      slide(marked, {
        slide: "element-order",
        id: file[0]!,
        node: elementId("256.4"),
        before: elementId("256.2"),
        among: [elementId("256.2"), elementId("256.4")],
      }).decision,
    ).toBe("apply")
    expect(
      slide(marked, {
        slide: "element-order",
        id: file[0]!,
        node: elementId("256.2"),
        before: null,
        among: [elementId("256.2"), elementId("256.4")],
      }).decision,
    ).toBe("apply")
  })
})
