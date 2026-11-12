import type { MarkupElement } from "./element-span.js"
import {
  contentTypesPart,
  partOf,
  presentationPart,
  presentationRels,
  relativeTarget,
  relsOf,
} from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { digits, insertAt, partBytes, replacePart, requireMarkup, rootClose } from "./part-markup.js"
import { xmlText } from "./shape-write.js"
import { nextRelationshipId } from "./slide-list-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

const relationshipRoot = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
const presentationType = "application/vnd.openxmlformats-officedocument.presentationml."
const themeType = "application/vnd.openxmlformats-officedocument.theme+xml"
const declaration = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
const namespaces = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const group = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`
const colorMap = `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`
const masterFollowers = ["p:handoutMasterIdLst", "p:sldIdLst", "p:sldSz", "p:notesSz"]

function value(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

export function notesParagraphs(text: string): string {
  return text
    .split("\n")
    .map((line) => `<a:p><a:r><a:t>${xmlText(line)}</a:t></a:r></a:p>`)
    .join("")
}

export function notesBodyShape(id: number, text: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Notes Placeholder ${id - 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${notesParagraphs(text)}</p:txBody></p:sp>`
}

function notesSlideXml(text: string): string {
  const image = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
  return `${declaration}<p:notes ${namespaces}><p:cSld><p:spTree>${group}${image}${notesBodyShape(3, text)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`
}

function size(elements: readonly MarkupElement[], kind: string, fallback: readonly [number, number]) {
  const found = elements.find((element) => element.kind === kind)
  const cx = digits(found === undefined ? "" : (value(found, "cx") ?? ""))
  const cy = digits(found === undefined ? "" : (value(found, "cy") ?? ""))
  return cx === null || cy === null || cx === 0 || cy === 0 ? fallback : ([cx, cy] as const)
}

function placeholder(id: number, name: string, type: string, box: readonly number[], locks: string): string {
  const [x, y, cx, cy] = box.map(Math.round)
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks ${locks}/></p:cNvSpPr><p:nvPr><p:ph type="${type}" idx="${id}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>${type === "body" ? `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>` : ""}</p:sp>`
}

function notesMasterXml(presentation: Uint8Array): string {
  const elements = requireMarkup(presentation).elements
  const [slideCx, slideCy] = size(elements, "p:sldSz", [12192000, 6858000])
  const [cx, cy] = size(elements, "p:notesSz", [6858000, 9144000])
  const width = cx * 0.8
  const image = Math.min(width * (slideCy / slideCx), cy * 0.3)
  const imageWidth = image * (slideCx / slideCy)
  const levels = Array.from(
    { length: 9 },
    (_, level) =>
      `<a:lvl${level + 1}pPr marL="${level * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${level + 1}pPr>`,
  ).join("")
  const shapes = [
    placeholder(
      2,
      "Slide Image Placeholder 1",
      "sldImg",
      [(cx - imageWidth) / 2, cy * 0.125, imageWidth, image],
      `noGrp="1" noRot="1" noChangeAspect="1"`,
    ),
    placeholder(3, "Notes Placeholder 2", "body", [cx * 0.1, cy * 0.48125, width, cy * 0.39375], `noGrp="1"`),
  ].join("")
  return `${declaration}<p:notesMaster ${namespaces}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${group}${shapes}</p:spTree></p:cSld>${colorMap}<p:notesStyle>${levels}</p:notesStyle></p:notesMaster>`
}

function relationshipsXml(rows: readonly (readonly [string, string])[]): string {
  const items = rows
    .map(
      ([type, target], index) =>
        `<Relationship Id="rId${index + 1}" Type="${relationshipRoot}${type}" Target="${target}"/>`,
    )
    .join("")
  return `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`
}

export function linkedPart(parts: Parts, source: string, type: string): string | null {
  const rels = parts.get(relsOf(source))
  if (rels === undefined) return null
  for (const element of requireMarkup(rels).elements) {
    if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
    if (!(value(element, "Type") ?? "").endsWith(`/${type}`)) continue
    const target = value(element, "Target")
    if (target !== null && target !== "") return partOf(source, target)
  }
  return null
}

export function freePart(parts: Parts, prefix: string): string {
  let max = 0
  for (const name of parts.keys()) {
    if (!name.startsWith(prefix) || !name.endsWith(".xml")) continue
    const number = digits(name.slice(prefix.length, name.length - 4))
    if (number !== null && number > max) max = number
  }
  return `${prefix}${max + 1}.xml`
}

function link(parts: Map<string, Uint8Array>, source: string, type: string, target: string): string {
  const name = relsOf(source)
  const rels = partBytes(parts, name)
  const document = requireMarkup(rels)
  const id = nextRelationshipId(document.elements)
  const row = `<Relationship Id="${id}" Type="${relationshipRoot}${type}" Target="${relativeTarget(source, target)}"/>`
  replacePart(parts, name, insertAt(rels, rootClose(document, "Relationships", "part"), encodeUtf8(row)))
  return id
}

function typed(parts: Map<string, Uint8Array>, part: string, contentType: string) {
  const types = partBytes(parts, contentTypesPart)
  const row = `<Override PartName="/${part}" ContentType="${contentType}"/>`
  replacePart(
    parts,
    contentTypesPart,
    insertAt(types, rootClose(requireMarkup(types), "Types", "part"), encodeUtf8(row)),
  )
}

function overrideType(parts: Parts, part: string): string | null {
  const name = `/${part}`
  for (const element of requireMarkup(partBytes(parts, contentTypesPart)).elements) {
    if (element.kind === "Override" && value(element, "PartName") === name) return value(element, "ContentType")
  }
  return null
}

export function notesMasterOf(parts: Parts): string | null {
  const master = linkedPart(parts, presentationPart, "notesMaster")
  return master !== null && parts.has(master) ? master : null
}

function copiedTheme(parts: Map<string, Uint8Array>): string {
  const slideMaster = linkedPart(parts, presentationPart, "slideMaster")
  const theme = slideMaster === null ? null : linkedPart(parts, slideMaster, "theme")
  if (theme === null || !parts.has(theme)) throw new Error("theme")
  const copy = freePart(parts, "ppt/theme/theme")
  parts.set(copy, partBytes(parts, theme))
  const rels = parts.get(relsOf(theme))
  if (rels !== undefined) parts.set(relsOf(copy), rels)
  typed(parts, copy, overrideType(parts, theme) ?? themeType)
  return copy
}

function createdMaster(parts: Map<string, Uint8Array>): string {
  const presentation = partBytes(parts, presentationPart)
  const elements = requireMarkup(presentation).elements
  if (elements.some((element) => element.kind === "p:notesMasterIdLst")) throw new Error("notes-master")
  const root = elements.find((element) => element.parent < 0)
  const follower = elements.find((element) => element.parent === root?.index && masterFollowers.includes(element.kind))
  if (follower === undefined) throw new Error("notes-master")
  const theme = copiedTheme(parts)
  const master = freePart(parts, "ppt/notesMasters/notesMaster")
  parts.set(master, encodeUtf8(notesMasterXml(presentation)))
  parts.set(relsOf(master), encodeUtf8(relationshipsXml([["theme", relativeTarget(master, theme)]])))
  typed(parts, master, `${presentationType}notesMaster+xml`)
  const id = link(parts, presentationPart, "notesMaster", master)
  const list = `<p:notesMasterIdLst><p:notesMasterId r:id="${id}"/></p:notesMasterIdLst>`
  replacePart(parts, presentationPart, insertAt(presentation, follower.start, encodeUtf8(list)))
  return master
}

export function newNotes(parts: Map<string, Uint8Array>, slide: string, text: string) {
  if (!parts.has(presentationRels)) throw new Error("notes-master")
  const master = notesMasterOf(parts) ?? createdMaster(parts)
  const notes = freePart(parts, "ppt/notesSlides/notesSlide")
  parts.set(notes, encodeUtf8(notesSlideXml(text)))
  parts.set(
    relsOf(notes),
    encodeUtf8(
      relationshipsXml([
        ["notesMaster", relativeTarget(notes, master)],
        ["slide", relativeTarget(notes, slide)],
      ]),
    ),
  )
  typed(parts, notes, `${presentationType}notesSlide+xml`)
  link(parts, slide, "notesSlide", notes)
}
