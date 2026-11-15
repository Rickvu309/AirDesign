import fs from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { storedZip } from "../stored-zip.mjs"
import { blankParts } from "./blank-deck.mjs"

const p = "http://schemas.openxmlformats.org/presentationml/2006/main"
const a = "http://schemas.openxmlformats.org/drawingml/2006/main"
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const group =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const steps = [
  { id: 2, label: "Plan", box: [1_524_000, 2_286_000, 2_286_000, 1_143_000] },
  { id: 3, label: "Build", box: [5_334_000, 3_810_000, 2_286_000, 1_143_000] },
]
const connectors = [
  {
    id: 4,
    name: "Elbow Connector 4",
    ends: [2, 3, 3, 1],
    xfrm: '<a:xfrm><a:off x="3810000" y="2857500"/><a:ext cx="1524000" cy="1524000"/></a:xfrm>',
    adjust: 50_000,
  },
  {
    id: 5,
    name: "Elbow Connector 5",
    ends: [2, 2, 3, 2],
    xfrm: '<a:xfrm rot="16200000" flipH="1"><a:off x="3810000" y="2286000"/><a:ext cx="1524000" cy="3810000"/></a:xfrm>',
    adjust: 115_000,
  },
]

const step = ({ id, label, box: [x, y, cx, cy] }) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${label}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="2000"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>${label}</a:t></a:r></a:p></p:txBody></p:sp>`

const connector = ({ id, name, ends: [from, start, to, end], xfrm, adjust }) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr><a:stCxn id="${from}" idx="${start}"/><a:endCxn id="${to}" idx="${end}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm}<a:prstGeom prst="bentConnector3"><a:avLst><a:gd name="adj1" fmla="val ${adjust}"/></a:avLst></a:prstGeom><a:ln w="19050"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`

export function connectorParts() {
  const parts = blankParts()
  const shapes = [...steps.map(step), ...connectors.map(connector)].join("")
  parts.set(
    "ppt/slides/slide1.xml",
    Buffer.from(
      `${declaration}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    ),
  )
  return parts
}

export const connectorDeck = () => storedZip(connectorParts())

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL("connectors.pptx", import.meta.url), connectorDeck())
}
