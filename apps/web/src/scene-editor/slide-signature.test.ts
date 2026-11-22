import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { landed, paint, spot } from "./scene-fixtures"
import { sameSignature, slideSignature } from "./slide-signature"

function deck() {
  const grown = scene.sceneFromTree({
    theme: scene.defaultTheme,
    slides: [
      { children: [{ type: "shape", name: "a", props: { box: spot(0, 0, 10, 10), fills: paint } }] },
      { children: [{ type: "shape", name: "b", props: { box: spot(0, 0, 10, 10), fills: paint } }] },
    ],
  })
  return { view: grown.scene, slides: grown.slides, ids: grown.ids }
}

describe("slide signature", () => {
  it("stays the same for a slide whose content nobody touched", () => {
    const { view, slides, ids } = deck()
    const next = landed(view, [{ node: ids.a!, prop: "box", value: spot(5, 5, 10, 10) }])
    expect(sameSignature(slideSignature(view, slides[1]!), slideSignature(next, slides[1]!))).toBe(true)
    expect(sameSignature(slideSignature(view, slides[0]!), slideSignature(next, slides[0]!))).toBe(false)
  })

  it("changes when a layer joins or leaves the slide", () => {
    const { view, slides, ids } = deck()
    const next = landed(view, [{ node: ids.b!, prop: "parent", value: null }])
    expect(sameSignature(slideSignature(view, slides[1]!), slideSignature(next, slides[1]!))).toBe(false)
  })

  it("changes for every slide when the deck's theme or size changes", () => {
    const { view, slides } = deck()
    const deckId = [...view.nodes.values()].find((node) => node.type === "deck")!.id
    const next = landed(view, [{ node: deckId, prop: "size", value: { w: 1280, h: 720 } }])
    expect(sameSignature(slideSignature(view, slides[0]!), slideSignature(next, slides[0]!))).toBe(false)
  })
})
