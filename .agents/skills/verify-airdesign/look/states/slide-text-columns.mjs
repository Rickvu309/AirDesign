import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const lines = (count) =>
  Array.from(
    { length: count },
    (_, at) =>
      `<a:p><a:r><a:rPr lang="en-US" sz="1600"><a:solidFill><a:srgbClr val="1D3557"/></a:solidFill></a:rPr><a:t>Line ${at + 1} of the text</a:t></a:r></a:p>`,
  ).join("")

const box = (id, name, [x, y, cx, cy], body, paragraphs) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DCE8F5"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="2F6DB5"/></a:solidFill></a:ln></p:spPr><p:txBody>${body}<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    box(
      10,
      "Two columns, middle, overflow",
      [609600, 1371600, 3352800, 914400],
      '<a:bodyPr numCol="2" anchor="ctr"><a:noAutofit/></a:bodyPr>',
      lines(14),
    ),
    box(
      11,
      "Two columns, top, overflow",
      [4419600, 1371600, 3352800, 914400],
      '<a:bodyPr numCol="2" anchor="t"><a:noAutofit/></a:bodyPr>',
      lines(14),
    ),
    box(
      12,
      "Two columns, middle, short",
      [8229600, 1371600, 3352800, 914400],
      '<a:bodyPr numCol="2" anchor="ctr"><a:noAutofit/></a:bodyPr>',
      lines(2),
    ),
    box(
      13,
      "Two columns, shrink",
      [4419600, 4114800, 3352800, 914400],
      '<a:bodyPr numCol="2" anchor="t"><a:normAutofit/></a:bodyPr>',
      lines(14),
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
  const file = path.join(kit.out, "text-columns.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#13"]')
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export default { name: "slide-text-columns", design: editor, drive }
