import fs from "node:fs"
import path from "node:path"
import { expect } from "@playwright/test"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { openDeck } from "../open-deck.mjs"

const lines = Array.from(
  { length: 8 },
  (_, at) =>
    `<a:p><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:srgbClr val="1D3557"/></a:solidFill></a:rPr><a:t>Line ${at + 1} of the text</a:t></a:r></a:p>`,
).join("")

const overflowing = `<p:sp><p:nvSpPr><p:cNvPr id="10" name="Overflowing text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1219200" y="914400"/><a:ext cx="4572000" cy="1371600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DCE8F5"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="2F6DB5"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${lines}</p:txBody></p:sp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const start = slide.indexOf("<p:sp>")
  const end = slide.indexOf("</p:spTree>")
  parts.set("ppt/slides/slide1.xml", Buffer.from(slide.slice(0, start) + overflowing + slide.slice(end)))
  return storedZip(parts)
}

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const file = path.join(kit.out, "autofit.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#10"]')
    .click({ position: { x: 4, y: 4 } })
  const section = kit.page
    .locator("[data-design-element] section")
    .filter({ has: kit.page.getByRole("heading", { name: "Text box", exact: true }) })
  await expect(section).toBeVisible()
  await section.getByText("Autofit", { exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-autofit", design: "/screens/s43-09-editor-tools-design-element", drive }
