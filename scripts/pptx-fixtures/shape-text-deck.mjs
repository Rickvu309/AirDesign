import { storedZip } from "../stored-zip.mjs"
import { blankParts } from "./blank-deck.mjs"

const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const label = "Revenue grew in every region this quarter"
const columns = [457_200, 4_495_800, 8_534_400]
const rows = [914_400, 3_886_200]
const presets = [
  ["ellipse", ""],
  ["chevron", ""],
  ["diamond", ""],
  ["rightArrow", ""],
  ["roundRect", '<a:gd name="adj" fmla="val 50000"/>'],
  ["homePlate", ""],
]

const shape = ([preset, adjusts], at) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${at + 2}" name="${preset}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${columns[at % 3]}" y="${rows[Math.floor(at / 3)]}"/><a:ext cx="3200400" cy="2057400"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst>${adjusts}</a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="DCE6F2"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1F4E79"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:srgbClr val="1F2937"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${label}</a:t></a:r></a:p></p:txBody></p:sp>`

export function shapeTextParts() {
  const parts = blankParts()
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      `${declaration}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}${presets.map(shape).join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    ),
  )
  return parts
}

export const shapeTextDeck = () => storedZip(shapeTextParts())
