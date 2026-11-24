import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { sampleRoutes } from "@/samples/sample-routes"
import { sampleSlides } from "@/samples/sample-slides"
import { screens } from "@/samples/sample-screens"

const measure = doom.measureWith({})
const slideSize = { w: 1920, h: 1080 }

type Placed = {
  readonly node: doom.Resolved
  readonly parent: doom.Resolved | null
  readonly x: number
  readonly y: number
}

function placed(
  nodes: readonly doom.Resolved[],
  parent: doom.Resolved | null,
  x: number,
  y: number,
): readonly Placed[] {
  return nodes.flatMap((node) => [
    { node, parent, x: x + node.box.x, y: y + node.box.y },
    ...placed(node.children, node, x + node.box.x, y + node.box.y),
  ])
}

describe("the sample slides", () => {
  it("registers one screen for each address", () => {
    expect(Object.keys(screens).sort()).toEqual(Object.values(sampleRoutes).sort())
    expect(Object.keys(sampleSlides).sort()).toEqual(Object.values(sampleRoutes).sort())
  })

  for (const [route, grown] of Object.entries(sampleSlides)) {
    const nodes = placed(doom.resolveSlide(grown.doom, grown.slides[0]!, measure), null, 0, 0)

    it(`${route} keeps every drawn part inside its frame, and every frame inside the slide`, () => {
      const outside = nodes.filter(({ node, parent, x, y }) => {
        const ring = node.geometry?.kind === "ellipse" && node.fills.length === 0
        if (ring || node.derived) return false
        const room =
          parent === null
            ? { x: 0, y: 0, w: slideSize.w, h: slideSize.h }
            : { x: x - node.box.x, y: y - node.box.y, w: parent.box.w, h: parent.box.h }
        const inX = node.box.x >= -1 && node.box.x + node.box.w <= room.w + 1
        const inY = node.box.y >= -1 && node.box.y + node.box.h <= room.h + 1
        return !(inX && inY)
      })
      expect(outside.map(({ node }) => node.id)).toEqual([])
    })

    it(`${route} fits every line of text in the width of its box`, () => {
      const wide = nodes.filter(({ node }) => node.text?.lines.some((line) => line.x + line.w > node.box.w + 1))
      expect(wide.map(({ node }) => node.id)).toEqual([])
    })

    it(`${route} names every derived part once`, () => {
      const ids = nodes.map(({ node }) => node.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  }
})
