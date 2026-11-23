import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  type Command,
  type IndexElement,
  type IndexSlide,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { exportParts, indexPackage, orderedParts, paintReader, type PaintBox } from "./index.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
export const part = "ppt/slides/slide1.xml"
export const slide = slideId("258")
export const file = [slide]

const shape = (id: number, x: number, y: number, cx: number, cy: number, fill = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr></p:sp>`
const fileGroup =
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm rot="5400000" flipH="1"><a:off x="1000000" y="1000000"/><a:ext cx="400000" cy="200000"/><a:chOff x="0" y="0"/><a:chExt cx="200000" cy="100000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:grpSpPr>` +
  `${shape(11, 0, 0, 100000, 100000)}${shape(12, 100000, 0, 100000, 100000, "<a:grpFill/>")}<p:extLst/></p:grpSp>`
export const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(4, 50000, 50000, 10000, 10000)}${shape(5, 400000, 300000, 100000, 100000)}${fileGroup}</p:spTree></p:cSld></p:sld>`

function packaged() {
  return new Map<string, Uint8Array>([
    [
      "ppt/presentation.xml",
      xml('<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>'),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      xml(
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
      ),
    ],
    [part, xml(body)],
    [
      "[Content_Types].xml",
      xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      ),
    ],
  ])
}

const parts = packaged()
const indexed = indexPackage(parts)
export const slides: readonly IndexSlide[] = indexed.slides
const read = indexed.elements
const turned = { "box.rot": [90], "box.flipH": [true] } as const
const elements: IndexElement[] = read.map((element) =>
  element.node === "258.10" ? { ...element, design: turned } : element,
)
export const opened: Register = {
  ...openRegister("", ""),
  index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
}
export const node = (shape: number) => elementId(`258.${shape}`)

export function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const named = command.command === "person" ? command.node : undefined
    if (named !== undefined && !current.nodes.includes(named)) {
      const added = decide(current, { command: "add", node: named, floor: "", route: "" })
      if (added.decision !== "apply") throw new Error(added.code)
      current = added.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

export const slideCommand = (edit: SlideCommand): Command => ({ command: "slide", file, edit })

export function wrapCommand(register: Register, shapes: readonly number[] = [3, 5]): SlideCommand {
  const changed = changeLayout(register, { wrap: shapes.map(node), slide, node: node(20), backdrop: node(21) })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return changed.slide
}

export function wrapped(register: Register): Register {
  return ran(register, [slideCommand(wrapCommand(register))])
}

export function exported(register: Register) {
  return exportParts(orderedParts(parts, register), register)
}

export function painted(shown: ReadonlyMap<string, Uint8Array>, shape: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(shape))?.box
  if (box === undefined || box === null) throw new Error(`paint ${shape}`)
  return box
}

export const gapped = (register: Register, gap: number) =>
  ran(register, [{ command: "person", v: 13, patch: { layout: { gap: { set: gap } } }, node: node(20) }])
