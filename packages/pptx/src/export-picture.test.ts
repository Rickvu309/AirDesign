import { elementId, slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { shownImage } from "./picture-read.js"
import { readSlides } from "./read-shapes.js"
import { freeShapeId } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const svgExtension = "{96DAC541-7B7A-43D3-8B79-37D633B846F1}"

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function text(parts: Parts, part: string): string {
  return decodeUtf8(parts.get(part)!)
}

describe("a picture added with an icon opening", () => {
  it("writes a p:pic whose blip is the icon's PNG with its SVG beside it, and export keeps it", async () => {
    const parts = await deck("clean.pptx")
    const slide = readSlides(parts)[0]!
    const id = slideId(slide.slide)
    const node = elementId(`${slide.slide}.${String(freeShapeId(parts, slide.part))}`)
    const opening = { fills: { source: { set: "rocket" } } }
    const element = {
      node,
      kind: "shape",
      value: null,
      box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
      grouped: false,
      opening,
    } as const
    const register = { file: [id], order: [{ slide: "element-add", id, element }] } as const
    const added = orderedParts(parts, register)
    const xml = text(added, slide.part)
    expect(xml).toContain(`<p:blipFill><a:blip r:embed="rId2"><a:extLst><a:ext uri="${svgExtension}">`)
    expect(text(added, "ppt/slides/_rels/slide1.xml.rels")).toContain('Target="../media/icon-rocket.svg"/>')
    const at = { slide: slide.slide, part: slide.part, shape: node.split(".")[1]! }
    expect(shownImage(added, at)?.source).toBe("rocket")
  })
})
