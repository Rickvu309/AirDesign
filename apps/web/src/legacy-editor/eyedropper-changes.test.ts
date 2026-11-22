import { elementId, openRegister, plainFrameTurn, slideId, type Register } from "@airdesign/document"
import { indexPackage, readShapes } from "@airdesign/pptx"
import { paintStore, type CanvasSlide, type Selection } from "@airdesign/render"
import { describe, expect, it } from "vitest"
import { eyedropperChanges, hasEyedropperTarget } from "@/legacy-editor/eyedropper-changes"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { recordsInFlight } from "@/editing/undo-list"

const xml = (value: string) => Uint8Array.from(value, (ch) => ch.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")

const textXml =
  '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
  '<p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="600000" cy="200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
  "<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp>"

const shapeXml = (id: number, x: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${x}" y="400000"/><a:ext cx="200000" cy="200000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="336699"/></a:solidFill></p:spPr></p:sp>`

const slideXml = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${textXml}${shapeXml(3, 100000)}${shapeXml(4, 400000)}</p:spTree></p:cSld></p:sld>`

function sampleParts() {
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
    [part, xml(slideXml)],
    [
      "[Content_Types].xml",
      xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      ),
    ],
  ])
}

function makeDeck(parts: ReadonlyMap<string, Uint8Array>, register: Register, selection: Selection): DesigningDeck {
  const store = paintStore()
  const shapes = new Map(readShapes(parts).map((each) => [elementId(`${each.slide}.${each.shape}`), each]))
  const canvas: CanvasSlide = {
    part,
    width: 9_144_000,
    height: 5_143_500,
    background: null,
    elements: [],
  }
  return {
    id: "deck-1",
    selection,
    settle: () => undefined,
    undo: {
      focused: { current: null },
      records: { current: recordsInFlight() },
      turnAfter: (work: () => Promise<void>) => {
        void work()
      },
    } as unknown as DesigningDeck["undo"],
    shown: {
      current: 0,
      store: { current: store },
      shownParts: { current: parts },
      displayParts: { current: parts },
      editParts: { current: parts },
      shownRegister: { current: register },
      movables: { current: new Map() },
      boxes: { current: new Map() },
      shapes: { current: shapes },
      canvases: { current: () => canvas },
    } as unknown as DesigningDeck["shown"],
  }
}

describe("eyedropperChanges", () => {
  it("sets text.fill for text layers, fills.paint for shapes, and both for mixed selections", () => {
    const parts = sampleParts()
    const indexed = indexPackage(parts)
    const register: Register = {
      ...openRegister("", ""),
      index: { ...indexed, total: indexed.elements.length, pages: [] },
    }
    const textNode = elementId("258.2")
    const shapeNode = elementId("258.3")
    const color = { rgb: "D93829" }

    expect(hasEyedropperTarget(makeDeck(parts, register, { ids: [], inside: null }))).toBe(false)

    const textDeck = makeDeck(parts, register, { ids: [textNode], inside: null })
    expect(hasEyedropperTarget(textDeck)).toBe(true)
    expect(eyedropperChanges(textDeck, color)).toEqual([
      { target: { node: textNode }, text: { fill: { solid: color } } },
    ])

    const shapeDeck = makeDeck(parts, register, { ids: [shapeNode], inside: null })
    expect(eyedropperChanges(shapeDeck, color)).toEqual([
      { target: { node: shapeNode }, fills: { paint: { solid: color } } },
    ])

    const mixedDeck = makeDeck(parts, register, { ids: [textNode, shapeNode], inside: null })
    expect(eyedropperChanges(mixedDeck, color)).toEqual([
      { target: { node: textNode }, text: { fill: { solid: color } } },
      { target: { node: shapeNode }, fills: { paint: { solid: color } } },
    ])
  })

  it("targets a frame's backdrop fill when a frame is selected", () => {
    const parts = sampleParts()
    const indexed = indexPackage(parts)
    const opened: Register = {
      ...openRegister("", ""),
      index: { ...indexed, total: indexed.elements.length, pages: [] },
    }
    const frameNode = elementId("258.20")
    const backdropNode = elementId("258.21")
    const turn = plainFrameTurn(opened, [slide], slide, frameNode, backdropNode, [elementId("258.3")])
    if (turn === null || turn[0]?.command !== "slide") throw new Error("frame")
    const framed: Register = { ...opened, order: [turn[0].edit] }
    const color = { rgb: "16A34A" }

    const frameDeck = makeDeck(parts, framed, { ids: [frameNode], inside: null })
    expect(hasEyedropperTarget(frameDeck)).toBe(true)
    expect(eyedropperChanges(frameDeck, color)).toEqual([
      { target: { node: backdropNode }, fills: { paint: { solid: color } } },
    ])
  })
})
