import { describe, expect, it } from "vitest"
import { currentBox, currentValue, decide, openRegister, type Register } from "./decide.js"
import { appendIndex, type IndexElement } from "./deck-index.js"
import { elementId, slideId } from "./element-id.js"
import { limits } from "./limits.js"
import { orderKeyBetween } from "./order-key.js"
import { format, stamps } from "./format.js"
import { floorFor, floorOpening, openingElement } from "./slide-floor.js"
import { readSlideState, type SlideCommand } from "./slide-order.js"

const file = [slideId("256"), slideId("257")] as const
const key = orderKeyBetween(null, null)
const box = { x: 1, y: 2, cx: 3, cy: 4 }

function indexed(): Register {
  const page = {
    once: "opening",
    offset: 0,
    total: 2,
    slides: file.map((id, position) => ({ id, position })),
    elements: [
      { node: elementId("256.2"), kind: "shape" as const, value: "Title", box, grouped: false },
      { node: elementId("257.2"), kind: "shape" as const, value: "Other", box: null, grouped: true },
    ],
  }
  const index = appendIndex(undefined, page)
  if (!index.ok) throw new Error(index.refusal)
  return { ...openRegister("", ""), index: index.index }
}

function landed(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

const placeholder: IndexElement = { node: elementId("258.2"), kind: "shape", value: null, box: null, grouped: false }

describe("the floor of a slide that was not in the file", () => {
  it("names each element of an added slide by the command's slide id and opens it from the floor", () => {
    const added = landed(indexed(), {
      slide: "add",
      id: slideId("258"),
      after: file[0],
      key,
      layout: file[0],
      floor: [placeholder],
    })
    expect(openingElement(added, elementId("258.2"))).toEqual(placeholder)
    expect(openingElement(added, elementId("258.3"))).toBeUndefined()
    const titled = { ...placeholder, node: elementId("258.3"), value: "Click" }
    const typed = landed(indexed(), {
      slide: "add",
      id: slideId("258"),
      after: file[0],
      key,
      layout: file[0],
      floor: [placeholder, titled],
    })
    const opened = decide(typed, { command: "add", node: titled.node, floor: "claimed", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    const body = opened.register.elements[titled.node]
    if (body === undefined) throw new Error("body")
    expect(currentValue(body)).toBe("Click")
  })

  it("renames the source's elements onto the clone, one for one", () => {
    const source = indexed().index?.elements.filter((element) => element.node.startsWith("256.")) ?? []
    const floor = floorFor(source, slideId("259"))
    expect(floor).toEqual([{ node: "259.2", kind: "shape", value: "Title", box, grouped: false }])
    const cloned = landed(indexed(), { slide: "clone", id: slideId("259"), source: file[0], key, floor })
    const opened = decide(cloned, { command: "add", node: elementId("259.2"), floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    const body = opened.register.elements[elementId("259.2")]
    if (body === undefined) throw new Error("body")
    expect(currentValue(body)).toBe("Title")
    expect(currentBox(body)).toEqual(box)
  })

  it("keeps the group rule on a clone of a grouped element", () => {
    const source = indexed().index?.elements.filter((element) => element.node.startsWith("257.")) ?? []
    const cloned = landed(indexed(), {
      slide: "clone",
      id: slideId("259"),
      source: file[1],
      key,
      floor: floorFor(source, slideId("259")),
    })
    const opened = decide(cloned, { command: "add", node: elementId("259.2"), floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    expect(
      decide(opened.register, { command: "person", property: "box", value: box, node: elementId("259.2") }),
    ).toEqual({
      decision: "refuse",
      code: "group-box",
    })
  })

  it("reads no floor row that names another slide, twice the same element, or a bad value", () => {
    const read = (floor: unknown) =>
      readSlideState({ file, order: [{ slide: "clone", id: "259", source: "256", key, floor }] })
    expect(read([{ ...placeholder, node: "259.2" }])?.order[0]).toMatchObject({ floor: [{ node: "259.2" }] })
    expect(read([placeholder])).toBeUndefined()
    expect(
      read([
        { ...placeholder, node: "259.2" },
        { ...placeholder, node: "259.2" },
      ]),
    ).toBeUndefined()
    expect(read([{ ...placeholder, node: "259.2", box: { x: 1 } }])).toBeUndefined()
    expect(read("rows")).toBeUndefined()
    const own = { node: "259.slide", kind: "slide", value: null, box: null, grouped: false }
    const fill = { fills: { p0: { set: { solid: { rgb: "0F2433" } } } } }
    expect(read([{ ...own, opening: fill }])?.order[0]).toMatchObject({ floor: [{ node: "259.slide", opening: fill }] })
    expect(read([{ ...own, node: "258.slide" }])).toBeUndefined()
    expect(readSlideState({ file, order: [{ slide: "clone", id: "259", source: "256", key }] })?.order[0]).toEqual({
      slide: "clone",
      id: "259",
      source: "256",
      key,
    })
  })

  it("carries each cloned element's opening patch, and reads no floor that says opening inside it", () => {
    const fills = { p0: { set: { solid: { scheme: "accent2" } } } }
    const read = (opening: unknown) =>
      readSlideState({
        file,
        order: [{ slide: "clone", id: "259", source: "256", key, floor: [{ ...placeholder, node: "259.2", opening }] }],
      })
    expect(read({ fills })?.order[0]).toMatchObject({ floor: [{ node: "259.2", opening: { fills } }] })
    expect(read({ fills: { p0: "inherit" } })?.order[0]).toMatchObject({
      floor: [{ opening: { fills: { p0: "inherit" } } }],
    })
    expect(read({ fills: { p0: "opening" } })).toBeUndefined()
    expect(read({ fills: { p0: { set: { solid: { scheme: "nope" } } } } })).toBeUndefined()
    expect(read({ glow: { value: "inherit" } })).toBeUndefined()
    expect(stamps.command).toBe(16)
  })

  it("gives a clone the fields its source shows, over the source's own opening, past the box and text", () => {
    const navy = { set: { solid: { rgb: "1F4E79" } } } as const
    const red = { set: { solid: { rgb: "C00000" } } } as const
    const cloned = landed(indexed(), {
      slide: "clone",
      id: slideId("259"),
      source: file[0],
      key,
      floor: [{ ...placeholder, node: elementId("259.2"), opening: { fills: { p0: navy } } }],
    })
    const node = elementId("259.2")
    expect(floorOpening(cloned, node, {})).toEqual({ fills: { p0: navy } })
    expect(floorOpening(cloned, node, { fills: { p0: "opening" } })).toEqual({ fills: { p0: navy } })
    expect(floorOpening(cloned, node, { fills: { p0: red }, box: { x: { set: 1 } } })).toEqual({
      fills: { p0: red },
    })
    expect(floorOpening(indexed(), elementId("256.2"), { fills: { p0: "inherit" } })).toEqual({
      fills: { p0: "inherit" },
    })
    expect(floorOpening(indexed(), elementId("256.2"), { text: { value: { set: "x" } } })).toBeUndefined()
    expect(format).toBeGreaterThan(stamps.command)
  })

  it("refuses a floor that would take the deck past its element limit or one device row", () => {
    const many = Array.from({ length: limits.elements - 1 }, (_, shape) => ({
      ...placeholder,
      node: elementId(`258.${shape + 2}`),
    }))
    expect(
      decide(indexed(), {
        command: "slide",
        file,
        edit: { slide: "add", id: slideId("258"), after: file[0], key, layout: file[0], floor: many },
      }),
    ).toEqual({ decision: "refuse", code: "limit" })
    const wide = [{ ...placeholder, value: "x".repeat(limits.row) }]
    expect(
      decide(indexed(), {
        command: "slide",
        file,
        edit: { slide: "add", id: slideId("258"), after: file[0], key, layout: file[0], floor: wide },
      }),
    ).toEqual({ decision: "refuse", code: "limit" })
  })
})
