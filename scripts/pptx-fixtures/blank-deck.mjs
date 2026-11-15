import fs from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { storedZip } from "../stored-zip.mjs"

const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const namespaces = `xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"`
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const colorMap =
  '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
const override = "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
const title = { type: "title", index: 0, box: [609600, 365760, 10972800, 1097280], size: 3600 }
const body = { type: "obj", index: 1, box: [609600, 1645920, 10972800, 4754880], size: 2400 }
const centered = { type: "ctrTitle", index: 0, box: [914400, 1828800, 10363200, 1371600], size: 4400 }
const subtitle = { type: "subTitle", index: 1, box: [914400, 3429000, 10363200, 1371600], size: 2400 }
const layouts = [
  { name: "Title Slide", type: "title", shapes: [centered, subtitle] },
  { name: "Title and Content", type: "obj", shapes: [title, body] },
  {
    name: "Section Header",
    type: "secHead",
    shapes: [
      { ...title, box: [914400, 2286000, 10363200, 1371600] },
      { ...body, type: "body", box: [914400, 3886200, 10363200, 1371600] },
    ],
  },
  {
    name: "Two Content",
    type: "twoObj",
    shapes: [
      title,
      { ...body, box: [609600, 1645920, 5303520, 4754880] },
      { ...body, index: 2, box: [6278880, 1645920, 5303520, 4754880] },
    ],
  },
  { name: "Title Only", type: "titleOnly", shapes: [title] },
  { name: "Blank", type: "blank", shapes: [] },
]

const shape = ({ type, index, box: [x, y, cx, cy], size }, n) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${n + 2}" name="${type} ${index}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${type}" idx="${index}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="${type === "ctrTitle" ? "ctr" : "t"}"/><a:lstStyle/><a:p><a:pPr algn="${type === "ctrTitle" || type === "subTitle" ? "ctr" : "l"}"><a:defRPr sz="${size}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`

const tree = (shapes) => `<p:spTree>${group}${shapes.map(shape).join("")}</p:spTree>`
const relationships = (items) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="rId${id}" Type="${r}/${type}" Target="${target}"/>`).join("")}</Relationships>`
const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
const font = '<a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/>'
const colors = [
  ["dk1", "202020"],
  ["lt1", "FFFFFF"],
  ["dk2", "1F3A5F"],
  ["lt2", "EEF2F6"],
  ["accent1", "2D6FCD"],
  ["accent2", "E07A2E"],
  ["accent3", "2F9E62"],
  ["accent4", "7A4FC4"],
  ["accent5", "D2455B"],
  ["accent6", "1E9AA8"],
  ["hlink", "2D6FCD"],
  ["folHlink", "7A4FC4"],
]
const theme = `<a:theme xmlns:a="${a}" name="Neutral"><a:themeElements><a:clrScheme name="Neutral">${colors.map(([name, value]) => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`).join("")}</a:clrScheme><a:fontScheme name="Arial"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme><a:fmtScheme name="Neutral"><a:fillStyleLst>${solid.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[6350, 12700, 19050].map((width) => `<a:ln w="${width}">${solid}<a:prstDash val="solid"/></a:ln>`).join("")}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${solid.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`

export function blankParts() {
  const parts = new Map()
  const put = (name, text) => parts.set(name, Buffer.from(declaration + text))
  const types = [
    ["/ppt/presentation.xml", "presentation.main"],
    ["/ppt/presProps.xml", "presProps"],
    ["/ppt/slideMasters/slideMaster1.xml", "slideMaster"],
    ["/ppt/slides/slide1.xml", "slide"],
    ...layouts.map((_, n) => [`/ppt/slideLayouts/slideLayout${n + 1}.xml`, "slideLayout"]),
  ]
  put(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.map(([name, type]) => `<Override PartName="${name}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.${type}+xml"/>`).join("")}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`,
  )
  put("_rels/.rels", relationships([[1, "officeDocument", "ppt/presentation.xml"]]))
  put(
    "ppt/presentation.xml",
    `<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  )
  put(
    "ppt/_rels/presentation.xml.rels",
    relationships([
      [1, "slideMaster", "slideMasters/slideMaster1.xml"],
      [2, "slide", "slides/slide1.xml"],
      [3, "presProps", "presProps.xml"],
    ]),
  )
  put("ppt/presProps.xml", `<p:presentationPr ${namespaces}/>`)
  put("ppt/theme/theme1.xml", theme)
  put(
    "ppt/slideMasters/slideMaster1.xml",
    `<p:sldMaster ${namespaces}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${tree([title, { ...body, type: "body" }])}</p:cSld>${colorMap}<p:sldLayoutIdLst>${layouts.map((_, n) => `<p:sldLayoutId id="${2147483649 + n}" r:id="rId${n + 1}"/>`).join("")}</p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
  )
  put(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    relationships([
      ...layouts.map((_, n) => [n + 1, "slideLayout", `../slideLayouts/slideLayout${n + 1}.xml`]),
      [7, "theme", "../theme/theme1.xml"],
    ]),
  )
  for (const [n, layout] of layouts.entries()) {
    put(
      `ppt/slideLayouts/slideLayout${n + 1}.xml`,
      `<p:sldLayout ${namespaces} type="${layout.type}" preserve="1"><p:cSld name="${layout.name}">${tree(layout.shapes)}</p:cSld>${override}</p:sldLayout>`,
    )
    put(
      `ppt/slideLayouts/_rels/slideLayout${n + 1}.xml.rels`,
      relationships([[1, "slideMaster", "../slideMasters/slideMaster1.xml"]]),
    )
  }
  put("ppt/slides/slide1.xml", `<p:sld ${namespaces}><p:cSld>${tree([centered, subtitle])}</p:cSld>${override}</p:sld>`)
  put("ppt/slides/_rels/slide1.xml.rels", relationships([[1, "slideLayout", "../slideLayouts/slideLayout1.xml"]]))
  return parts
}

export const blankDeck = () => storedZip(blankParts())

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const file of ["blank.pptx", "../../apps/web/src/decks/blank.pptx"]) {
    fs.writeFileSync(new URL(file, import.meta.url), blankDeck())
  }
}
