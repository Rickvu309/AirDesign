import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const stops =
  '<a:gsLst><a:gs pos="0"><a:srgbClr val="FFD54A"/></a:gs><a:gs pos="100000"><a:srgbClr val="1F4E9E"/></a:gs></a:gsLst>'
const centre = '<a:fillToRect l="50000" t="50000" r="50000" b="50000"/>'
const corner = '<a:fillToRect l="0" t="0" r="100000" b="100000"/>'
const rectangle = (id, name, x, y, fillToRect) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="5029200" cy="2286000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:gradFill>${stops}<a:path path="rect">${fillToRect}</a:path></a:gradFill></p:spPr></p:sp>`
const line = (id, name, y, dash) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="609600" y="${y}"/><a:ext cx="5029200" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="57150"><a:solidFill><a:srgbClr val="C0392B"/></a:solidFill><a:prstDash val="${dash}"/></a:ln></p:spPr></p:cxnSp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    rectangle(10, "Gradient from the centre", 6553200, 609600, centre),
    rectangle(11, "Gradient from the corner", 6553200, 3200400, corner),
    line(12, "Dot line", 1371600, "dot"),
    line(13, "Square dot line", 2133600, "sysDot"),
    line(14, "Dash line", 2895600, "dash"),
  ].join("")
  const start = slide.indexOf("<p:sp>")
  const end = slide.indexOf("</p:spTree>")
  parts.set("ppt/slides/slide1.xml", Buffer.from(slide.slice(0, start) + shapes + slide.slice(end)))
  return storedZip(parts)
}

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const file = path.join(kit.out, "line-and-gradient.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#11"]')
}

export default { name: "slide-line-and-gradient", design: editor, drive }
