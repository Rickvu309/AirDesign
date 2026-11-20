import { storedZip } from "../stored-zip.mjs"
import { blankParts } from "./blank-deck.mjs"

const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

const shape = (preset, at) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${at + 2}" name="${preset}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${1_371_600 + at * 5_029_200}" y="1371600"/><a:ext cx="3657600" cy="3657600"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1F4E79"/></a:solidFill></a:ln></p:spPr></p:sp>`

export function shapeFacesParts() {
  const parts = blankParts()
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      `${declaration}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}${["cube", "can"].map(shape).join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    ),
  )
  return parts
}

export const shapeFacesDeck = () => storedZip(shapeFacesParts())
