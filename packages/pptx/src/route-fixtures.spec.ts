import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { copyName } from "./layer-names.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"

function names(elements: readonly MarkupElement[]): readonly MarkupElement[] {
  return elements.filter((element) => element.kind === "p:cNvPr")
}

function attribute(mark: MarkupElement | undefined, name: string) {
  return mark?.attributes.find((item) => item.name === name)
}

function backToSource(piece: Uint8Array, source: Uint8Array): Uint8Array | string {
  const marks = names(requireMarkup(piece).elements)
  const sourceMarks = names(requireMarkup(source).elements)
  if (marks.length !== sourceMarks.length) return "the copy holds another number of layers"
  const edits: ByteEdit[] = []
  for (const [index, mark] of marks.entries()) {
    const id = attribute(mark, "id")
    const was = sourceMarks[index]?.id
    if (id === undefined || was === null || was === undefined) return "a layer of the copy has no id"
    edits.push({ start: id.valueStart, end: id.valueEnd, next: encodeUtf8(was) })
    const name = attribute(mark, "name")
    const sourceName = attribute(sourceMarks[index], "name")
    if (name === undefined || sourceName === undefined || name.value === sourceName.value) continue
    if (name.value !== copyName(sourceName.value, mark.id ?? "")) return `the copy is named ${name.value}`
    edits.push({ start: name.valueStart, end: name.valueEnd, next: encodeUtf8(sourceName.value) })
  }
  return spliceBytes(piece, edits)
}

export function cloneFault(old: Uint8Array, next: Uint8Array, shape: string): string | null {
  const elements = requireMarkup(old).elements
  const found = shapeById(elements, shape)
  const end = found.end + next.length - old.length
  if (!sameBytes(spliceBytes(next, [{ start: found.end, end, next: new Uint8Array() }]), old))
    return "bytes outside the copy changed"
  const restored = backToSource(next.slice(found.end, end), old.slice(found.start, found.end))
  if (typeof restored === "string") return restored
  if (!sameBytes(restored, old.slice(found.start, found.end))) return "the copy differs from its source"
  const used = new Set(names(elements).map((mark) => mark.id))
  const fresh = names(requireMarkup(next.slice(found.end, end)).elements).map((mark) => mark.id)
  if (new Set(fresh).size !== fresh.length || fresh.some((id) => used.has(id))) return "the copy reuses an id"
  return null
}

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Hello</a:t></a:r></a:p><a:p><a:r><a:t>World</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="G"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9" cy="9"/><a:chOff x="0" y="0"/><a:chExt cx="9" cy="9"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="11" name="C"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp></p:grpSp><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr><a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr></a:tbl></p:spTree></p:cSld></p:sld>`

export function routeHosts(): Map<string, Uint8Array> {
  return new Map([
    ["ppt/slides/slide1.xml", encodeUtf8(slide)],
    [
      "ppt/slides/slide2.xml",
      encodeUtf8(
        `<p:sld><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Grid"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="20" cy="1"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="10"/><a:gridCol w="10"/></a:tblGrid></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
      ),
    ],
    [
      "ppt/presentation.xml",
      encodeUtf8(
        `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="1" cy="1"/><p14:section id="1"/><p14:section id="2"/></p:presentation>`,
      ),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      encodeUtf8(
        `<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide3.xml"/></Relationships>`,
      ),
    ],
    ["ppt/slides/slide3.xml", encodeUtf8("<p:sld/>")],
    ["ppt/media/keep.bin", Uint8Array.of(1, 2, 3)],
  ])
}

export function commonPrefix(left: Uint8Array, right: Uint8Array): number {
  let at = 0
  while (at < left.length && at < right.length && left[at] === right[at]) at += 1
  return at
}
