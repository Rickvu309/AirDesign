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
const gap = 127_000
const frame = [1_000_000, 1_000_000, 3_627_000, 1_000_000]
const backdrop = { id: 3, name: "Backdrop", preset: "rect", color: "bg2", box: frame }
const children = [
  { id: 4, name: "Rectangle", preset: "rect", color: "accent1", box: [1_000_000, 1_000_000, 2_000_000, 1_000_000] },
  { id: 5, name: "Oval", preset: "ellipse", color: "accent2", box: [3_127_000, 1_000_000, 1_500_000, 600_000] },
]

const xfrm = ([x, y, cx, cy]) => `<a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/>`

const shape = ({ id, name, preset, color, box }) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>${xfrm(box)}</a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="${color}"/></a:solidFill></p:spPr></p:sp>`

function seal() {
  const boxText = (box) => box.join(",")
  const text = [boxText(frame), ...children.map((child) => `${String(child.id)}:${boxText(child.box)}`)].join("|")
  let hash = 0x811c9dc5
  for (const unit of text) hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, "0")
}

const marker = () =>
  `1;b=${String(backdrop.id)};f=h;g=${String(gap)};p=0,0,0,0;a=topLeft;c=${children.map((child) => child.id).join(",")};s=${seal()}`

const grouped = () =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="Frame"/><p:cNvGrpSpPr/><p:nvPr><p:custDataLst><p:tags r:id="rId2"/></p:custDataLst></p:nvPr></p:nvGrpSpPr><p:grpSpPr><a:xfrm>${xfrm(frame)}<a:chOff x="${frame[0]}" y="${frame[1]}"/><a:chExt cx="${frame[2]}" cy="${frame[3]}"/></a:xfrm></p:grpSpPr>${[backdrop, ...children].map(shape).join("")}</p:grpSp>`

export function frameParts() {
  const parts = blankParts()
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      `${declaration}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${tree}${grouped()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    ),
  )
  parts.set(
    "ppt/tags/tag1.xml",
    Buffer.from(`${declaration}<p:tagLst xmlns:p="${p}"><p:tag name="AIRDESIGN_LAYOUT" val="${marker()}"/></p:tagLst>`),
  )
  const rels = parts.get("ppt/slides/_rels/slide1.xml.rels").toString()
  const tagType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"
  parts.set(
    "ppt/slides/_rels/slide1.xml.rels",
    Buffer.from(
      rels.replace(
        "</Relationships>",
        `<Relationship Id="rId2" Type="${tagType}" Target="../tags/tag1.xml"/></Relationships>`,
      ),
    ),
  )
  const types = parts.get("[Content_Types].xml").toString()
  const tagContent = "application/vnd.openxmlformats-officedocument.presentationml.tags+xml"
  parts.set(
    "[Content_Types].xml",
    Buffer.from(
      types.replace("</Types>", `<Override PartName="/ppt/tags/tag1.xml" ContentType="${tagContent}"/></Types>`),
    ),
  )
  return parts
}

export const frameDeck = () => storedZip(frameParts())

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL("frame.pptx", import.meta.url), frameDeck())
}
