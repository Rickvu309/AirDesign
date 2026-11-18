import fs from "node:fs"
import path from "node:path"
import { storedZip } from "./stored-zip.mjs"

export const sectionProofDeck = "doe-heat-pumps.pptx"

const presentation = "ppt/presentation.xml"
const zoomSlide = "ppt/slides/slide1.xml"
const appendices = "{1FE94D9B-CEE8-4448-8F0B-9CD832F32C6F}"
const partTwo = "{45EA7723-C68D-4570-8DAA-C0AC0547D697}"
const missing = "{0E5EC7A1-0000-4000-8000-000000000000}"
const decoder = new TextDecoder()
const encoder = new TextEncoder()

const replaced = (xml, from, to) => {
  const at = xml.indexOf(from)
  if (at < 0 || xml.indexOf(from, at + 1) >= 0) throw new Error(`section proof cannot plant at ${from}`)
  return xml.slice(0, at) + to + xml.slice(at + from.length)
}

const planted = (parts, name, edit) => new Map(parts).set(name, encoder.encode(edit(decoder.decode(parts.get(name)))))

const inList = (from, to) => (parts) => planted(parts, presentation, (xml) => replaced(xml, from, to))

const sectionOf = (xml, id) => {
  const start = xml.lastIndexOf("<p14:section ", xml.indexOf(`id="${id}"`))
  const end = xml.indexOf("</p14:section>", start) + "</p14:section>".length
  if (start < 0 || end < start) throw new Error(`section proof has no section ${id}`)
  return xml.slice(start, end)
}

const zoom = (id) =>
  `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:psez="http://schemas.microsoft.com/office/powerpoint/2016/sectionzoom" Requires="psez"><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="9000" name="Section Zoom"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="3048000" cy="1714500"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/powerpoint/2016/sectionzoom"><psez:sectionZm><psez:sectionZmObj sectionId="${id}"><psez:zmPr xmlns:p166="http://schemas.microsoft.com/office/powerpoint/2016/6/main" id="{7A3C1E55-2B4D-4F6A-8C9E-0D1F2A3B4C5D}" returnToParent="0" transitionDur="1000"><p166:blipFill><a:blip/><a:stretch><a:fillRect/></a:stretch></p166:blipFill><p166:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3048000" cy="1714500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p166:spPr></psez:zmPr></psez:sectionZmObj></psez:sectionZm></a:graphicData></a:graphic></p:graphicFrame></mc:Choice><mc:Fallback/></mc:AlternateContent>`

const zoomed = (id) => (parts) =>
  planted(parts, zoomSlide, (xml) => replaced(xml, "</p:spTree>", `${zoom(id)}</p:spTree>`))

export const sectionPlants = [
  { name: "zoom", rule: null, what: "a section zoom to a section the list has", plant: zoomed(appendices) },
  {
    name: "uncovered",
    rule: "cover",
    what: "a slide in no section",
    plant: inList('<p14:sldId id="2775"/>', ""),
  },
  {
    name: "twice",
    rule: "cover",
    what: "a slide in two sections",
    plant: inList('<p14:sldId id="2774"/>', '<p14:sldId id="2773"/><p14:sldId id="2774"/>'),
  },
  {
    name: "order",
    rule: "order",
    what: "a section moved without its slides",
    plant: (parts) =>
      planted(parts, presentation, (xml) => {
        const moved = sectionOf(xml, appendices)
        return replaced(replaced(xml, moved, ""), sectionOf(xml, partTwo), `${moved}${sectionOf(xml, partTwo)}`)
      }),
  },
  {
    name: "malformed",
    rule: "id",
    what: "a section id that is not a GUID",
    plant: inList(`id="${appendices}"`, 'id="{1FE94D9B}"'),
  },
  {
    name: "duplicate",
    rule: "id",
    what: "two sections with one id",
    plant: inList(`id="${appendices}"`, `id="${partTwo}"`),
  },
  {
    name: "stray",
    rule: "slide",
    what: "a section slide the deck lacks",
    plant: inList('<p14:sldId id="2775"/>', '<p14:sldId id="2775"/><p14:sldId id="9999"/>'),
  },
  {
    name: "dangling",
    rule: "reference",
    what: "a section zoom to a section the list lacks",
    plant: zoomed(missing),
    base: "zoom",
  },
]

export const sectionProofFile = (name) => `section-proof-${name}.pptx`

export const writeSectionProof = ({ parts, directory }) =>
  sectionPlants.map((row) => {
    const file = path.join(directory, sectionProofFile(row.name))
    const written = row.plant(parts)
    fs.writeFileSync(file, storedZip(written))
    return { ...row, file, parts: written }
  })

export const sectionProofLines = ({ pptx, proof, lists }) =>
  proof.map((row) => {
    const before = lists.get(row.base === undefined ? sectionProofDeck : sectionProofFile(row.base))
    const after = lists.get(sectionProofFile(row.name))
    const found = pptx.sectionListFailures(row.parts)
    const ours = row.rule === null ? found.length === 0 : found.some((failure) => failure.startsWith(`${row.rule}:`))
    const validator =
      before === undefined || after === undefined
        ? "gave no answer"
        : pptx.newValidatorErrors(before, after).length > 0
          ? "sees it"
          : "is blind"
    const check = row.rule === null ? (ours ? "passes it" : "fails it") : ours ? "finds it" : "misses it"
    return `section list proof ${row.rule ?? "clean"}, ${row.what}: our check ${check}, the validator ${validator}`
  })

export const sectionWarnLines = ({ pptx, files }) => {
  const lines = []
  for (const [name, parts] of files) {
    const failures = pptx.sectionListFailures(parts)
    if (failures.length > 0) lines.push(`section list warns ${name}: ${failures.length}, first ${failures[0]}`)
  }
  lines.push(`section list checked ${files.length} files, ${lines.length} warn, and it blocks nothing yet`)
  return lines
}
