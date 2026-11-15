import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const solid = (color) => `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`
const stops =
  '<a:gsLst><a:gs pos="0"><a:srgbClr val="2F6DB5"/></a:gs><a:gs pos="100000"><a:srgbClr val="E76F51"/></a:gs></a:gsLst>'
const linear = `<a:gradFill rotWithShape="1">${stops}<a:lin ang="0" scaled="1"/></a:gradFill>`
const fromSides = `<a:gradFill rotWithShape="1">${stops}<a:path path="rect"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`
const soft = '<a:effectLst><a:softEdge rad="203200"/></a:effectLst>'
const shadow = (turns) =>
  `<a:effectLst><a:outerShdw blurRad="76200" dist="152400" dir="2700000" rotWithShape="${turns}"><a:srgbClr val="000000"><a:alpha val="50000"/></a:srgbClr></a:outerShdw></a:effectLst>`
const glow =
  '<a:effectLst><a:glow rad="177800"><a:srgbClr val="F4A261"><a:alpha val="70000"/></a:srgbClr></a:glow></a:effectLst>'

const shape = (id, name, [x, y, cx, cy], preset, fill, effects = "", words = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${fill}${effects}</p:spPr>${words === "" ? "" : `<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${words}</a:t></a:r></a:p></p:txBody>`}</p:sp>`

const group = (id, name, [x, y, cx, cy], effects, inside, turn = 0) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm${turn === 0 ? "" : ` rot="${turn}"`}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${x}" y="${y}"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm>${effects}</p:grpSpPr>${inside}</p:grpSp>`

function deck() {
  const parts = blankParts()
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    shape(10, "Soft linear gradient", [609600, 457200, 2743200, 1371600], "rect", linear, soft),
    shape(11, "Soft gradient from the sides", [4343400, 457200, 2743200, 1371600], "rect", fromSides, soft),
    group(
      12,
      "Soft group",
      [8077200, 457200, 2743200, 1371600],
      soft,
      shape(13, "Left", [8077200, 457200, 1600200, 1371600], "ellipse", solid("2F6DB5")) +
        shape(14, "Right", [9220200, 457200, 1600200, 1371600], "ellipse", solid("2A9D8F")),
    ),
    group(
      20,
      "Shadow group",
      [609600, 2514600, 2743200, 1371600],
      shadow(0),
      shape(21, "Back", [609600, 2514600, 1828800, 1066800], "rect", solid("2F6DB5")) +
        shape(22, "Front", [1524000, 2819400, 1828800, 1066800], "rect", solid("E76F51"), "", "Group"),
    ),
    group(
      30,
      "Glow group",
      [4343400, 2514600, 2743200, 1371600],
      glow,
      shape(31, "One", [4343400, 2743200, 914400, 914400], "ellipse", solid("2F6DB5")) +
        shape(32, "Two", [5257800, 2743200, 914400, 914400], "ellipse", solid("2A9D8F")) +
        shape(33, "Three", [6172200, 2743200, 914400, 914400], "ellipse", solid("E76F51")),
    ),
    group(
      40,
      "Turned shadow group",
      [8077200, 2514600, 2743200, 1371600],
      shadow(1),
      shape(41, "Bar", [8077200, 2743200, 2743200, 914400], "rect", solid("2F6DB5")) +
        shape(42, "Mark", [9144000, 2514600, 609600, 1371600], "rect", solid("E76F51")),
      1800000,
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
  const file = path.join(kit.out, "group-effects.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#42"]')
}

export default { name: "slide-group-effects", design: editor, drive }
