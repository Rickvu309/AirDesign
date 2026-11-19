import { expect, it } from "vitest"
import { morphPairs } from "./index.js"
import { encodeUtf8 } from "./package-bytes.js"

function shape(id: string, name: string, x: number): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${String(x)}" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:sp>`
}

function slide(shapes: string): Uint8Array {
  return encodeUtf8(
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld></p:sld>`,
  )
}

it("pairs the layers that share one name on both slides, as Figma's Smart animate and PowerPoint's !! names do", () => {
  const from = slide(
    shape("2", "Circle", 0) +
      shape("3", "!!Title", 0) +
      shape("4", "Twin", 0) +
      shape("5", "Twin", 0) +
      shape("6", "Gone", 0),
  )
  const to = slide(
    shape("7", "Circle", 500) + shape("8", "!!Title", 900) + shape("9", "Twin", 0) + shape("10", "New", 0),
  )
  expect(morphPairs(from, to)).toEqual([
    ["2", "7"],
    ["3", "8"],
  ])
})
