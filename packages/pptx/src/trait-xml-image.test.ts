import { describe, expect, it } from "vitest"
import { iconOfPart, iconParts } from "./picture-write.js"

describe("an icon's color is the color its SVG and PNG are drawn in", () => {
  it("names black with no template slot by the plain parts, so older decks keep their bytes", () => {
    expect(iconParts("rocket", 200, { hex: "000000" })).toEqual(iconParts("rocket"))
    expect(iconOfPart("ppt/media/icon-rocket.svg")).toEqual({ name: "rocket", weight: 200, color: { hex: "000000" } })
    expect(iconOfPart("ppt/media/icon-rocket.c000000.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c000000.tx1.svg")).toEqual({
      name: "rocket",
      weight: 200,
      color: { hex: "000000", scheme: "tx1" },
    })
    expect(iconOfPart("ppt/media/icon-rocket.c4472c4.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c4472C4.plum.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c6F9BD9.accent1.lumMod60000.lumOff40000.svg")).toEqual({
      name: "rocket",
      weight: 200,
      color: {
        hex: "6F9BD9",
        scheme: "accent1",
        transforms: [
          { op: "lumMod", val: 60_000 },
          { op: "lumOff", val: 40_000 },
        ],
      },
    })
    expect(iconOfPart("ppt/media/icon-rocket.c6F9BD9.accent1.glow5.svg")).toBeNull()
  })
})
