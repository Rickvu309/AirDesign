import { describe, expect, it } from "vitest"
import {
  clonedLayer,
  elementGone,
  elementId,
  newSlideElement,
  openingElement,
  slideGone,
  slideId,
  type DeckIndex,
  type IndexElement,
  type SlideCommand,
  type SlideState,
} from "./index.js"
import { groupBounds } from "./element-group.js"
import { applySlide, openSlides } from "./slide-order.js"

const slide = slideId("256")
const other = slideId("257")
const file = [slide, other] as const
const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 100_000, y: 100_000, cx: 200_000, cy: 100_000 }

function shapeElement(id: number, target = slide): IndexElement {
  return { node: elementId(`${target}.${String(id)}`), kind: "shape", value: "", box, grouped: false }
}

function buildOrder(count: number): {
  readonly state: SlideState
  readonly nodes: readonly ReturnType<typeof elementId>[]
} {
  let state = openSlides()
  const nodes: ReturnType<typeof elementId>[] = []
  for (let i = 0; i < count; i += 1) {
    const element = shapeElement(10 + i)
    const applied = applySlide(state, file, { slide: "element-add", id: slide, element })
    if (!applied.ok) throw new Error(applied.code)
    state = applied.state
    nodes.push(element.node)
  }
  const removed = applySlide(state, file, { slide: "remove", id: other })
  if (!removed.ok) throw new Error(removed.code)
  return { state: removed.state, nodes }
}

function countedOrder(order: readonly SlideCommand[]): {
  readonly order: readonly SlideCommand[]
  readonly reads: () => number
} {
  let count = 0
  const proxy = new Proxy(order, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) count += 1
      return Reflect.get(target, property, receiver)
    },
  })
  return { order: proxy, reads: () => count }
}

describe("order lookup cost stays linear across nodes", () => {
  it("answers slideGone, elementGone, openingElement, newSlideElement and clonedLayer without walking order per node", () => {
    const { state, nodes } = buildOrder(100)
    const tracked = countedOrder(state.order)
    const seen: SlideState = { ...state, order: tracked.order }
    for (const node of nodes) {
      expect(slideGone(seen, slide)).toBe(false)
      expect(slideGone(seen, other)).toBe(true)
      expect(elementGone(seen, node)).toBe(false)
      expect(openingElement(seen, node)?.node).toBe(node)
      expect(newSlideElement(seen, node)).toBeUndefined()
      expect(clonedLayer(seen, node)).toBeUndefined()
    }
    expect(tracked.reads()).toBeLessThanOrEqual(state.order.length * 6)
  })

  it("matches lifecycle transitions for backdrops, clones, ungroups, restores and nested groups", () => {
    const first = shapeElement(2)
    const second = shapeElement(3)
    const members = [
      { node: first.node, box },
      { node: second.node, box },
    ]
    const frameBox = groupBounds(members)
    const frame = { node: elementId("256.4"), kind: "group" as const, value: null, box: frameBox, grouped: false }
    const backdrop = { node: elementId("256.5"), kind: "shape" as const, value: null, box: frameBox, grouped: false }
    const outer = { node: elementId("256.6"), kind: "group" as const, value: null, box: frameBox, grouped: false }
    let state = openSlides()
    for (const command of [
      { slide: "element-add" as const, id: slide, element: first },
      { slide: "element-add" as const, id: slide, element: second },
      {
        slide: "element-group" as const,
        id: slide,
        element: frame,
        backdrop,
        members,
      },
      { slide: "element-ungroup" as const, id: slide, node: frame.node },
    ]) {
      const applied = applySlide(state, file, command)
      if (!applied.ok) throw new Error(applied.code)
      state = applied.state
    }
    expect(elementGone(state, frame.node)).toBe(true)
    expect(elementGone(state, backdrop.node)).toBe(true)
    expect(elementGone(state, first.node)).toBe(false)
    const regrouped = applySlide(state, file, { slide: "element-regroup", id: slide, node: frame.node })
    if (!regrouped.ok) throw new Error(regrouped.code)
    expect(elementGone(regrouped.state, frame.node)).toBe(false)
    expect(elementGone(regrouped.state, backdrop.node)).toBe(false)
    const addedSeven = applySlide(regrouped.state, file, { slide: "element-add", id: slide, element: shapeElement(7) })
    if (!addedSeven.ok) throw new Error(addedSeven.code)
    const nested = applySlide(addedSeven.state, file, {
      slide: "element-group",
      id: slide,
      element: outer,
      members: [
        { node: frame.node, box: frameBox },
        { node: elementId("256.7"), box },
      ],
    })
    if (!nested.ok) throw new Error(nested.code)
    const removedOuter = applySlide(nested.state, file, { slide: "element-remove", id: slide, node: outer.node })
    if (!removedOuter.ok) throw new Error(removedOuter.code)
    expect(elementGone(removedOuter.state, outer.node)).toBe(true)
    expect(elementGone(removedOuter.state, frame.node)).toBe(true)
    expect(elementGone(removedOuter.state, first.node)).toBe(true)
    expect(elementGone(removedOuter.state, backdrop.node)).toBe(true)

    const filed: DeckIndex = {
      format: 2,
      total: 2,
      slides: [{ id: slide, position: 0, size, free: 20 }],
      elements: [
        {
          node: elementId("256.11"),
          kind: "group",
          value: null,
          box,
          grouped: false,
          framing: {
            backdrop: elementId("256.12"),
            children: [],
            layout: { flow: "horizontal", gap: 0, padding: [0, 0, 0, 0], align: "topLeft" },
          },
        },
        { node: elementId("256.12"), kind: "shape", value: null, box, grouped: true, group: elementId("256.11") },
      ],
      pages: [],
    }
    const order: readonly SlideCommand[] = [{ slide: "element-remove", id: slide, node: elementId("256.11") }]
    const withoutIndex: SlideState = { file, order }
    const withIndex: SlideState = { file, order, index: filed }
    expect(elementGone(withoutIndex, elementId("256.12"))).toBe(false)
    expect(elementGone(withIndex, elementId("256.12"))).toBe(true)
  })
})
