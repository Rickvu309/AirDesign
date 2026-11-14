import fs from "node:fs"
import path from "node:path"
import { blankParts } from "../../../../../scripts/pptx-fixtures/blank-deck.mjs"
import { storedZip } from "../../../../../scripts/stored-zip.mjs"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const blue = '<a:solidFill><a:srgbClr val="2F6DB5"/></a:solidFill>'
const ink = '<a:ln w="38100"><a:solidFill><a:srgbClr val="1D3557"/></a:solidFill></a:ln>'
const shadow = (attributes) =>
  `<a:effectLst><a:outerShdw ${attributes}><a:srgbClr val="000000"><a:alpha val="45000"/></a:srgbClr></a:outerShdw></a:effectLst>`
const shape = (id, name, x, y, preset, fill, inside, extra = "", xfrm = "", style = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm${xfrm}><a:off x="${x}" y="${y}"/><a:ext cx="2743200" cy="1371600"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${fill}${extra}${inside}</p:spPr>${style}</p:sp>`
const effectRef =
  '<p:style><a:lnRef idx="0"><a:srgbClr val="000000"/></a:lnRef><a:fillRef idx="0"><a:srgbClr val="000000"/></a:fillRef><a:effectRef idx="2"><a:srgbClr val="000000"/></a:effectRef></p:style>'

function deck() {
  const parts = blankParts()
  const theme = String(parts.get("ppt/theme/theme1.xml"))
  const styles = [
    "<a:effectStyle><a:effectLst/></a:effectStyle>",
    `<a:effectStyle>${shadow('blurRad="152400" dist="76200" dir="2700000" algn="tl" rotWithShape="0"')}</a:effectStyle>`,
    "<a:effectStyle><a:effectLst/></a:effectStyle>",
  ].join("")
  parts.set(
    "ppt/theme/theme1.xml",
    Buffer.from(
      theme.replace(/<a:effectStyleLst>.*?<\/a:effectStyleLst>/s, `<a:effectStyleLst>${styles}</a:effectStyleLst>`),
    ),
  )
  const slide = String(parts.get("ppt/slides/slide1.xml"))
  const shapes = [
    shape(10, "Style shadow", 609600, 457200, "rect", blue, "", "", "", effectRef),
    shape(
      11,
      "Own shadow",
      4343400,
      457200,
      "roundRect",
      blue,
      shadow('blurRad="228600" dist="114300" dir="5400000" algn="t" rotWithShape="0"'),
    ),
    shape(
      12,
      "Triangle shadow",
      8077200,
      457200,
      "triangle",
      blue,
      shadow('blurRad="76200" dist="152400" dir="2700000" rotWithShape="0"'),
    ),
    shape(
      13,
      "Glow",
      609600,
      2514600,
      "ellipse",
      blue,
      '<a:effectLst><a:glow rad="228600"><a:srgbClr val="F4A261"><a:alpha val="60000"/></a:srgbClr></a:glow></a:effectLst>',
    ),
    shape(14, "Soft edge", 4343400, 2514600, "rect", blue, '<a:effectLst><a:softEdge rad="203200"/></a:effectLst>'),
    shape(
      15,
      "Turned, fixed shadow",
      8077200,
      2514600,
      "rect",
      blue,
      shadow('blurRad="76200" dist="228600" dir="2700000" rotWithShape="0"'),
      "",
      ' rot="1800000"',
    ),
    shape(
      16,
      "Outline shadow",
      609600,
      4572000,
      "rect",
      "<a:noFill/>",
      shadow('blurRad="50800" dist="127000" dir="2700000" rotWithShape="0"'),
      ink,
    ),
    shape(
      17,
      "Scaled shadow",
      4343400,
      4572000,
      "rect",
      blue,
      shadow('blurRad="101600" dist="0" dir="0" sx="120000" sy="120000" algn="ctr" rotWithShape="0"'),
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
  const file = path.join(kit.out, "effects.pptx")
  fs.writeFileSync(file, deck())
  await openDeck(kit.page, file)
  await kit.page.waitForSelector('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#17"]')
}

export default { name: "slide-effects", design: editor, drive }
