import { expect, it } from "vitest"
import { build, lastChild, minter, titledSlide } from "./agent-fixtures.js"
import { bottomLimitOf, contentAreaOf } from "./agent-place.js"
import { propOf } from "./doom-walk.js"

it("fills a lone chart down to the bottom margin", () => {
  const { doom: start, on } = titledSlide()
  const doom = build(
    start,
    {
      op: "add",
      slide: on,
      kind: "component",
      component: "column",
      box: contentAreaOf(start, on)!,
    },
    minter("c"),
  )
  const box = propOf(lastChild(doom, on), "box")!
  expect(box.y + box.h).toBe(bottomLimitOf(1080))
})
