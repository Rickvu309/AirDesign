import fs from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { storedZip } from "../stored-zip.mjs"
import { blankParts } from "./blank-deck.mjs"

const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const tree =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

const xfrm = ([x, y, cx, cy]) => `<a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/>`

const shape = (id, name, preset, color, box) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>${xfrm(box)}</a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="${color}"/></a:solidFill></p:spPr></p:sp>`

const group = (id, name, turn, box, space, children) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm${turn}>${xfrm(box)}<a:chOff x="${space[0]}" y="${space[1]}"/><a:chExt cx="${space[2]}" cy="${space[3]}"/></a:xfrm></p:grpSpPr>${children.join("")}</p:grpSp>`

const inner = group(
  3,
  "Turned",
  ' rot="1800000" flipH="1"',
  [400_000, 300_000, 1_300_000, 600_000],
  [400_000, 300_000, 1_300_000, 600_000],
  [
    shape(4, "Leaf", "rect", "accent1", [400_000, 300_000, 600_000, 600_000]),
    shape(5, "Twin", "ellipse", "accent2", [1_100_000, 300_000, 600_000, 600_000]),
  ],
)

const outer = group(
  2,
  "Scaled",
  "",
  [1_500_000, 1_500_000, 5_000_000, 3_000_000],
  [0, 0, 2_500_000, 1_500_000],
  [inner, shape(6, "Beside", "roundRect", "accent3", [1_700_000, 500_000, 700_000, 700_000])],
)

export function groupParts() {
  const parts = blankParts()
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      `${declaration}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${tree}${outer}${shape(7, "Loose", "rect", "accent4", [8_000_000, 1_500_000, 2_000_000, 1_500_000])}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    ),
  )
  return parts
}

export const groupDeck = () => storedZip(groupParts())

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL("nested-groups.pptx", import.meta.url), groupDeck())
}
