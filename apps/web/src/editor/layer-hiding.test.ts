import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { onSlide, xml } from "@/slide-fixtures"
import { hidingOf } from "./layer-hiding"

const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const box = (id: number, hidden: boolean) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="Box ${String(id)}"${hidden ? ' hidden="1"' : ""}/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`
const parts = onSlide(
  xml(`<p:sld ${tags}><p:cSld><p:spTree>${box(2, false)}${box(3, true)}${box(4, true)}</p:spTree></p:cSld></p:sld>`),
)

it("hides the selection while any of it shows, and shows it once all of it is hidden, as Ctrl+Shift+H does", () => {
  expect(hidingOf(parts, [elementId("256.2")])).toBe(true)
  expect(hidingOf(parts, [elementId("256.2"), elementId("256.3")])).toBe(true)
  expect(hidingOf(parts, [elementId("256.3"), elementId("256.4")])).toBe(false)
  expect(hidingOf(parts, [])).toBeNull()
})
