import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { frameSize, scaledGrid } from "./table-size.js"

const cell = "<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody><a:tcPr/></a:tc>"

function slide(cx: number, cy: number): Uint8Array {
  const grid = [1_000_000, 2_000_000, 3_000_000].map((width) => `<a:gridCol w="${width}"/>`).join("")
  const rows = [300_000, 600_000].map((height) => `<a:tr h="${height}">${cell.repeat(3)}</a:tr>`).join("")
  return encodeUtf8(
    `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm><a:graphic><a:graphicData uri="t"><a:tbl><a:tblPr/><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
  )
}

function sizes(bytes: Uint8Array) {
  const xml = decodeUtf8(bytes)
  return {
    widths: [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((match) => Number(match[1])),
    heights: [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((match) => Number(match[1])),
  }
}

describe("scaledGrid", () => {
  it("reads the table frame's size, and none for a shape that holds no table", () => {
    expect(frameSize(slide(6_000_000, 900_000), "4")).toEqual({ cx: 6_000_000, cy: 900_000 })
    expect(() => frameSize(slide(6_000_000, 900_000), "5")).toThrow()
  })

  it("scales each column by the frame's new width and each row by its new height", () => {
    const scaled = scaledGrid(slide(9_000_000, 1_350_000), "4", { cx: 6_000_000, cy: 900_000 })
    expect(sizes(scaled)).toEqual({ widths: [1_500_000, 3_000_000, 4_500_000], heights: [450_000, 900_000] })
  })

  it("rounds to whole EMU and keeps the columns adding up to the new width", () => {
    const scaled = scaledGrid(slide(7_000_000, 900_000), "4", { cx: 6_000_000, cy: 900_000 })
    expect(sizes(scaled)).toEqual({ widths: [1_166_667, 2_333_333, 3_500_000], heights: [300_000, 600_000] })
  })

  it("scales rows that already outgrew the frame by the same ratio, so the frame and the rows keep their gap", () => {
    const scaled = scaledGrid(slide(6_000_000, 1_200_000), "4", { cx: 6_000_000, cy: 600_000 })
    expect(sizes(scaled).heights).toEqual([600_000, 1_200_000])
  })

  it("returns the same bytes when the frame kept its size", () => {
    const bytes = slide(6_000_000, 900_000)
    expect(scaledGrid(bytes, "4", { cx: 6_000_000, cy: 900_000 })).toBe(bytes)
  })
})
