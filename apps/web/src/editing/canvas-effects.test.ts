import type { PaintEffects } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { canvasEffects } from "@/editing/canvas-effects"

const css = (hex: string, alpha = ""): string => `#${hex}${alpha}`

const shadow = {
  blur: 40_000,
  distance: 23_000,
  direction: 90,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  align: "b",
  rotateWithShape: false,
  color: { hex: "000000", alpha: 0.35 },
}

describe("canvasEffects", () => {
  it("gives nothing when the file gives no effects", () => {
    expect(canvasEffects(undefined)).toBeUndefined()
  })

  it("keeps every shadow attribute and writes its colour with its alpha", () => {
    expect(canvasEffects({ shadow })).toEqual({ shadow: { ...shadow, color: css("000000", "59") } })
  })

  it("writes a glow's colour and keeps the soft edge radius", () => {
    const effects: PaintEffects = {
      glow: { radius: 101_600, color: { hex: "FF0000", alpha: 1 } },
      softEdge: { radius: 63_500 },
    }
    expect(canvasEffects(effects)).toEqual({
      glow: { radius: 101_600, color: css("FF0000") },
      softEdge: { radius: 63_500 },
    })
  })

  it("adds no kind the file did not give", () => {
    expect(Object.keys(canvasEffects({ softEdge: { radius: 1 } }) ?? {})).toEqual(["softEdge"])
  })
})
