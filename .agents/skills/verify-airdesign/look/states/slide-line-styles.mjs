import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const red = '<a:solidFill><a:srgbClr val="C0392B"/></a:solidFill>'
const line = (id, name, y, attributes, inside) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="609600" y="${y}"/><a:ext cx="4572000" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln ${attributes}>${red}${inside}</a:ln></p:spPr></p:cxnSp>`
const rectangle = (id, name, x, y, inside) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="2286000" cy="1371600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="190500">${red}${inside}</a:ln></p:spPr></p:sp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    line(10, "Round cap dash", 457200, 'w="152400" cap="rnd"', '<a:prstDash val="dash"/>'),
    line(
      11,
      "Custom dash",
      1066800,
      'w="76200"',
      '<a:custDash><a:ds d="400000" sp="100000"/><a:ds d="50000" sp="250000"/></a:custDash>',
    ),
    line(12, "Double line", 1676400, 'w="114300" cmpd="dbl"', ""),
    line(13, "Thick thin line", 2286000, 'w="114300" cmpd="thickThin"', ""),
    line(14, "Triple line", 2895600, 'w="114300" cmpd="tri"', ""),
    line(15, "Large arrow", 3505200, 'w="38100"', '<a:tailEnd type="triangle" w="lg" len="lg"/>'),
    line(16, "Small arrow", 4114800, 'w="38100"', '<a:tailEnd type="triangle" w="sm" len="sm"/>'),
    line(17, "Wide short arrow", 4724400, 'w="38100"', '<a:tailEnd type="stealth" w="lg" len="sm"/>'),
    rectangle(18, "Bevel join", 6096000, 609600, "<a:bevel/>"),
    rectangle(19, "Round join", 6096000, 2438400, "<a:round/>"),
    rectangle(20, "Miter join", 6096000, 4267200, '<a:miter lim="800000"/>'),
  ].join("")
  const start = slide.indexOf("<p:sp>")
  const end = slide.indexOf("</p:spTree>")
  parts.set("ppt/slides/slide1.xml", Buffer.from(slide.slice(0, start) + shapes + slide.slice(end)))
  return storedZip(parts)
}

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const file = path.join(kit.out, "line-styles.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#20"]')
}

export default { name: "slide-line-styles", design: editor, drive }
