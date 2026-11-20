import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, readSlideId, type DeckIndex, type Geometry, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { openDeck, readDeckPage, type Deck } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }

function drawn(...shapes: readonly (readonly [number, Geometry])[]): Deck {
  const id = readDeckId("deck")
  const slide = readSlideId("258")
  if (!id.ok || slide === undefined) throw new Error("deck")
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: 0,
    slides: [{ id: slide, position: 0, size, free: 2 }],
    elements: [],
    pages: [],
  }
  let register: Register = { ...opened.register, index }
  for (const [shape, geometry] of shapes) {
    const line = geometry === "line" || geometry === "straightConnector1"
    const box = { x: 914_400, y: 914_400 * shape, cx: 1_828_800, cy: line ? 0 : 914_400 }
    const element = {
      node: elementId(`258.${String(shape)}`),
      kind: line ? "connector" : "shape",
      value: null,
      box,
      grouped: false,
    } as const
    const done = decide(register, {
      command: "slide",
      file: [slide],
      edit: { slide: "element-add", id: slide, element, geometry },
    })
    if (done.decision !== "apply") throw new Error(done.code)
    register = done.register
  }
  return { ...opened, register }
}

function design(deck: Deck, shape: number): string | undefined {
  return readDeckPage(deck, { runId: null, slide: "258" }).elements.find((each) => each.node === `258.${String(shape)}`)
    ?.design
}

describe("an agent reads a layer a person drew from the Shapes tray", () => {
  it("tells an arrow from a line by its arrowhead, and gives both their preset, width and color", () => {
    const deck = drawn([2, "line"], [3, "straightConnector1"])
    expect(design(deck, 2)).toBe("geometry line · border.width 2.3 · border.fill accent1 (style)")
    expect(design(deck, 3)).toBe(
      "geometry straightConnector1 · border.width 2.3 · border.fill accent1 (style) · border.tail triangle",
    )
  })

  it("names a drawn ellipse's preset and the style's fill and border it paints with", () => {
    expect(design(drawn([2, "ellipse"]), 2)).toBe(
      "geometry ellipse · fills accent1 (style) · border.width 1 (style) · border.fill accent1 shade 15 (style)",
    )
  })
})
