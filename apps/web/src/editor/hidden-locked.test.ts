import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { landed, spot } from "./testing/doom-fixtures"
import { heldBack, showWrites } from "./hidden-locked"
import { testTheme } from "@airdesign/doom/testing"

function slideWithHeldLayers() {
  const grown = doom.doomFromTree({
    theme: testTheme,
    slides: [
      {
        name: "One",
        children: [
          { type: "shape", name: "seen", props: { box: spot(0, 0, 10, 10) } },
          { type: "shape", name: "hidden", props: { box: spot(0, 0, 10, 10), hidden: true } },
          {
            type: "frame",
            name: "card",
            props: { box: spot(0, 0, 100, 100), locked: true },
            children: [
              { type: "shape", name: "inner", props: { box: spot(0, 0, 10, 10), hidden: true, locked: true } },
            ],
          },
        ],
      },
      {
        name: "Two",
        children: [{ type: "shape", name: "elsewhere", props: { box: spot(0, 0, 10, 10), hidden: true } }],
      },
    ],
  })
  return { view: grown.doom, slide: grown.slides[0]!, id: (name: string) => grown.ids[name]! }
}

describe("hidden and locked layers on a slide", () => {
  it("finds every hidden and every locked layer on the slide, inside frames too, and none on other slides", () => {
    const { view, slide, id } = slideWithHeldLayers()
    const held = heldBack(view, slide)
    expect(held.hidden).toEqual([id("hidden"), id("inner")])
    expect(held.locked).toEqual([id("card"), id("inner")])
  })

  it("shows all hidden layers in one edit and leaves them locked", () => {
    const { view, slide, id } = slideWithHeldLayers()
    const after = landed(view, showWrites(heldBack(view, slide).hidden, "hidden"))
    expect(heldBack(after, slide)).toEqual({ hidden: [], locked: [id("card"), id("inner")] })
  })

  it("unlocks all locked layers in one edit and leaves them hidden", () => {
    const { view, slide, id } = slideWithHeldLayers()
    const after = landed(view, showWrites(heldBack(view, slide).locked, "locked"))
    expect(heldBack(after, slide)).toEqual({ hidden: [id("hidden"), id("inner")], locked: [] })
  })

  it("finds nothing on a slide with nothing held back", () => {
    const { view, id } = slideWithHeldLayers()
    const two = doom.slidesOf(view)[1]!.id
    const after = landed(view, showWrites([id("elsewhere")], "hidden"))
    expect(heldBack(after, two)).toEqual({ hidden: [], locked: [] })
  })
})
