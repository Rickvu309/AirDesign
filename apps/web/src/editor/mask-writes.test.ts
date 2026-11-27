import { describe, expect, it } from "vitest"
import { doomFromTree, type NodeId } from "@airdesign/doom"
import { maskWrites } from "./mask-writes"
import { testTheme } from "@airdesign/doom/testing"

const spot = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

function deck() {
  return doomFromTree({
    theme: testTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "back", props: { box: spot(0, 0, 40, 40) } },
          { type: "shape", name: "front", props: { box: spot(10, 10, 40, 40), mask: true } },
          { type: "frame", name: "group", props: { box: spot(80, 0, 40, 40) } },
        ],
      },
    ],
  })
}

describe("Use as mask", () => {
  it("writes the mask prop on, and takes it off when every layer is already a mask", () => {
    const grown = deck()
    const back = grown.ids.back!
    const front = grown.ids.front!
    const on = maskWrites(grown.doom, [back])
    expect(on).toEqual([{ node: back, prop: "mask", value: true }])
    const off = maskWrites(grown.doom, [front])
    expect(off).toEqual([{ node: front, prop: "mask", value: false }])
    const mixed = maskWrites(grown.doom, [back, front])
    expect(mixed.map((write) => write.value)).toEqual([true, true])
  })

  it("skips a layer that is not a frame or a shape", () => {
    const grown = deck()
    expect(maskWrites(grown.doom, [grown.slides[0] as NodeId])).toEqual([])
  })
})
