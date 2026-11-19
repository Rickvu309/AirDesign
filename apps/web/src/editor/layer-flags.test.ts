import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { onSlide, xml } from "@/slide-fixtures"
import { flagTurnsOn } from "./layer-flags"

const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const box = (id: number, hidden: boolean, locked: boolean) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="Box ${String(id)}"${hidden ? ' hidden="1"' : ""}/><p:cNvSpPr>${locked ? '<a:spLocks noMove="1" noResize="1" noRot="1"/>' : ""}</p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`
const parts = onSlide(
  xml(
    `<p:sld ${tags}><p:cSld><p:spTree>${box(2, false, false)}${box(3, true, true)}${box(4, true, true)}</p:spTree></p:cSld></p:sld>`,
  ),
)
const [two, three, four] = [elementId("256.2"), elementId("256.3"), elementId("256.4")]

it("hides the selection while any of it shows, and shows it once all of it is hidden, as Ctrl+Shift+H does", () => {
  expect(flagTurnsOn(parts, [two], "hidden")).toBe(true)
  expect(flagTurnsOn(parts, [two, three], "hidden")).toBe(true)
  expect(flagTurnsOn(parts, [three, four], "hidden")).toBe(false)
  expect(flagTurnsOn(parts, [], "hidden")).toBeNull()
})

it("locks the selection while any of it is free, and unlocks it once all of it is locked, as Ctrl+Shift+L does", () => {
  expect(flagTurnsOn(parts, [two, three], "locked")).toBe(true)
  expect(flagTurnsOn(parts, [three, four], "locked")).toBe(false)
})
