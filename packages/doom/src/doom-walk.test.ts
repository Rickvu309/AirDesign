import { describe, expect, it } from "vitest"
import * as doom from "./index.js"
import { doomFromTree } from "./doom-tree.js"
import { defaultTheme } from "./theme.js"

const box = (x = 0, y = 0, w = 200, h = 100): doom.Box => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const rowLayout: doom.Layout = {
  mode: "row",
  gap: 16,
  padding: { t: 0, r: 0, b: 0, l: 0 },
  align: "top-left",
}

function sample() {
  const grown = doomFromTree({
    theme: defaultTheme,
    slides: [
      {
        name: "One",
        children: [
          {
            type: "frame",
            name: "flow",
            props: { box: box(0, 0, 600, 200), layout: rowLayout },
            children: [
              { type: "shape", name: "inFlow", props: { box: box(0, 0, 100, 100) } },
              { type: "shape", name: "pinned", props: { box: box(0, 0, 100, 100), absolute: true } },
            ],
          },
          {
            type: "frame",
            name: "lockedFrame",
            props: { box: box(0, 220, 300, 200), locked: true },
            children: [{ type: "shape", name: "insideLocked", props: { box: box(10, 10, 80, 80) } }],
          },
          { type: "shape", name: "card", props: { box: box(400, 220, 200, 100) } },
          {
            type: "shape",
            name: "icon",
            props: { box: box(700, 220, 48, 48), geometry: { kind: "icon", name: "lucide/star" } },
          },
          {
            type: "shape",
            name: "rule",
            props: {
              geometry: {
                kind: "line",
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
                route: "straight",
                arrows: ["none", "none"],
              },
            },
          },
        ],
      },
      { name: "Two", children: [] },
    ],
  })
  return grown
}

describe("doom tree walks", () => {
  it("reads props and parent slots from nodes without throwing on missing nodes", () => {
    const { doom: view, ids, slides } = sample()
    const card = view.nodes.get(ids.card!)
    expect(doom.propOf(card, "name")).toBe("card")
    expect(doom.propOf(undefined, "name")).toBeUndefined()
    expect(doom.parentOf(card)?.id).toBe(slides[0])
    expect(doom.parentOf(undefined)).toBeUndefined()
  })

  it("lists only live children and skips dead or missing entries", () => {
    const { doom: view, slides, ids } = sample()
    const slide = slides[0]!
    const deleted: doom.Node = { id: doom.nodeId("dead:1"), type: "shape", parent: null, rev: doom.rev(1) }
    const nodes = new Map(view.nodes).set(deleted.id, deleted)
    const children = new Map(view.children).set(slide, [
      ...(view.children.get(slide) ?? []),
      deleted.id,
      doom.nodeId("missing:1"),
    ])
    const dirty: doom.Doom = { ...view, nodes, children }
    expect(doom.childrenOf(dirty, slide).map((node) => node.id)).toEqual([
      ids.flow,
      ids.lockedFrame,
      ids.card,
      ids.icon,
      ids.rule,
    ])
  })

  it("lists live slides only from visible slideRows", () => {
    const { doom: view, slides } = sample()
    const deck = [...view.nodes.values()].find((node) => node.type === "deck")!
    const visibleRow = doom.parentOf(view.nodes.get(slides[0]!))!.id
    const hiddenRow = doom.nodeId("r:91")
    const hiddenSlide = doom.nodeId("s:92")
    const strayGroup = doom.nodeId("f:93")
    const strayChild = doom.nodeId("s:94")
    const deadSlide = doom.nodeId("s:95")
    const nodes = new Map(view.nodes)
    nodes.set(hiddenRow, {
      id: hiddenRow,
      type: "slideRow",
      parent: { id: deck.id, at: doom.orderKeyBetween(null, null) },
      hidden: true,
      rev: doom.rev(1),
    })
    nodes.set(hiddenSlide, {
      id: hiddenSlide,
      type: "slide",
      parent: { id: hiddenRow, at: doom.orderKeyBetween(null, null) },
      rev: doom.rev(1),
    })
    nodes.set(strayGroup, {
      id: strayGroup,
      type: "frame",
      parent: { id: deck.id, at: doom.orderKeyBetween(null, null) },
      rev: doom.rev(1),
    })
    nodes.set(strayChild, {
      id: strayChild,
      type: "slide",
      parent: { id: strayGroup, at: doom.orderKeyBetween(null, null) },
      rev: doom.rev(1),
    })
    nodes.set(deadSlide, { id: deadSlide, type: "slide", parent: null, rev: doom.rev(1) })
    const children = new Map(view.children)
    children.set(deck.id, [...(view.children.get(deck.id) ?? []), hiddenRow, strayGroup])
    children.set(hiddenRow, [hiddenSlide])
    children.set(strayGroup, [strayChild])
    children.set(visibleRow, [...(view.children.get(visibleRow) ?? []), deadSlide])
    const dirty: doom.Doom = { ...view, nodes, children }
    expect(doom.slidesOf(dirty).map((slide) => slide.id)).toEqual(slides)
  })

  it("detects locked layers through any locked ancestor", () => {
    const { doom: view, ids } = sample()
    expect(doom.lockedIn(view, ids.lockedFrame!)).toBe(true)
    expect(doom.lockedIn(view, ids.insideLocked!)).toBe(true)
    expect(doom.lockedIn(view, ids.card!)).toBe(false)
    expect(doom.lockedIn(view, doom.nodeId("missing:1"))).toBe(false)
  })

  it("identifies children laid out in an auto-layout frame's flow", () => {
    const { doom: view, ids } = sample()
    expect(doom.flows(view, ids.inFlow!)).toBe(true)
    expect(doom.flows(view, ids.pinned!)).toBe(false)
    expect(doom.flows(view, ids.card!)).toBe(false)
    expect(doom.flows(view, ids.insideLocked!)).toBe(false)
    expect(doom.flows(view, doom.nodeId("missing:1"))).toBe(false)
  })

  it("accepts shapes with no words yet as holding text, and rejects frames, icons, lines and missing layers", () => {
    const { doom: view, ids } = sample()
    expect(doom.holdsText(view, ids.card!)).toBe(true)
    expect(doom.holdsText(view, ids.flow!)).toBe(false)
    expect(doom.holdsText(view, ids.icon!)).toBe(false)
    expect(doom.holdsText(view, ids.rule!)).toBe(false)
    expect(doom.holdsText(view, doom.nodeId("missing:1"))).toBe(false)
  })
})
