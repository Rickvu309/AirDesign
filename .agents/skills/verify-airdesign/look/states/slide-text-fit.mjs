import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const lines = (count, size) =>
  Array.from(
    { length: count },
    (_, at) =>
      `<a:p><a:r><a:rPr lang="en-US" sz="${size}"><a:solidFill><a:srgbClr val="1D3557"/></a:solidFill></a:rPr><a:t>Line ${at + 1} of the text</a:t></a:r></a:p>`,
  ).join("")

const box = (id, name, [x, y, cx, cy], body, paragraphs) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DCE8F5"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="2F6DB5"/></a:solidFill></a:ln></p:spPr><p:txBody>${body}<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    box(
      10,
      "Two columns, middle",
      [609600, 457200, 3352800, 1828800],
      '<a:bodyPr numCol="2" anchor="ctr"><a:noAutofit/></a:bodyPr>',
      lines(3, 1600),
    ),
    box(
      11,
      "Two columns, bottom",
      [4419600, 457200, 3352800, 1828800],
      '<a:bodyPr numCol="2" anchor="b"><a:noAutofit/></a:bodyPr>',
      lines(3, 1600),
    ),
    box(
      12,
      "Two columns, full",
      [8229600, 457200, 3352800, 1828800],
      '<a:bodyPr numCol="2" anchor="ctr"><a:noAutofit/></a:bodyPr>',
      lines(10, 1600),
    ),
    box(
      13,
      "Shrink on overflow",
      [609600, 2743200, 3352800, 1371600],
      '<a:bodyPr anchor="t"><a:normAutofit/></a:bodyPr>',
      lines(9, 1800),
    ),
    box(
      14,
      "Resize shape to fit",
      [4419600, 2743200, 3352800, 457200],
      '<a:bodyPr anchor="t"><a:spAutoFit/></a:bodyPr>',
      lines(5, 1800),
    ),
    box(
      15,
      "Stored scale",
      [8229600, 2743200, 3352800, 1371600],
      '<a:bodyPr anchor="t"><a:normAutofit fontScale="62500" lnSpcReduction="20000"/></a:bodyPr>',
      lines(5, 2800),
    ),
  ].join("")
  const start = slide.indexOf("<p:sp>")
  const end = slide.indexOf("</p:spTree>")
  parts.set("ppt/slides/slide1.xml", Buffer.from(slide.slice(0, start) + shapes + slide.slice(end)))
  return storedZip(parts)
}

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const file = path.join(kit.out, "text-fit.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#15"]')
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export default { name: "slide-text-fit", design: editor, drive }
