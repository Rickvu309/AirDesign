import {
  decide,
  elementId,
  format,
  openRegister,
  plainFrameTurn,
  slideId,
  type Command,
  type Register,
} from "@airdesign/document"
import { indexPackage } from "@airdesign/pptx"
import { describe, expect, it, vi } from "vitest"
import type { DesignDeck } from "@/design/design-change"
import { hasPlainFrame, resizeFramesToFit } from "@/editor/frame-fit-action"

vi.mock("@/design/design-change", () => ({
  changeRows: vi.fn(),
}))

import { changeRows } from "@/design/design-change"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const shape = (id: number, x: number, y: number, cx: number, cy: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(4, 400000, 200000, 100000, 100000)}</p:spTree></p:cSld></p:sld>`
const parts = new Map<string, Uint8Array>([
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

function ran(register: Register, commands: readonly Command[]): Register {
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

function deckOf(register: Register): DesignDeck {
  return {
    id: "deck",
    shown: { shownParts: { current: parts }, shownRegister: { current: register } },
  } as unknown as DesignDeck
}

describe("frame-fit-action", () => {
  it("recognizes plain frames and plans empty rows when a frame already fits", () => {
    vi.mocked(changeRows).mockClear()
    const { slides, elements } = indexPackage(parts)
    const opened: Register = {
      ...openRegister("", ""),
      index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
    }
    const frame = elementId("258.20")
    const back = elementId("258.21")
    const turn = plainFrameTurn(opened, [slide], slide, frame, back, [elementId("258.3"), elementId("258.4")])
    if (turn === null) throw new Error("plain frame")
    const framed = ran(opened, turn)

    expect(hasPlainFrame(deckOf(framed), [elementId("258.3")])).toBe(false)
    expect(hasPlainFrame(deckOf(framed), [frame])).toBe(true)
    expect(resizeFramesToFit(deckOf(framed), [elementId("258.3")])).toBe(false)
    expect(changeRows).not.toHaveBeenCalled()

    expect(resizeFramesToFit(deckOf(framed), [frame])).toBe(true)
    expect(changeRows).toHaveBeenCalledTimes(1)
    const plan = vi.mocked(changeRows).mock.calls[0]?.[1]
    expect(vi.mocked(changeRows).mock.calls[0]?.[2]).toBe("resize-to-fit")
    expect(plan?.(framed)).toEqual([])

    const enlarged = ran(framed, [
      { command: "person", v: format, node: frame, patch: { box: { w: { set: 700000 }, h: { set: 400000 } } } },
    ])
    expect(plan?.(enlarged)?.length).toBeGreaterThan(0)
  })
})
