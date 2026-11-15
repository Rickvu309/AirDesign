import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Alpha,
  type Command,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { shownFill } from "./fill-read.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { shownCrop, shownIdentity, shownImage } from "./picture-read.js"
import { iconParts, withMedia } from "./picture-write.js"
import { readSlides } from "./read-shapes.js"
import { freeShapeId } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"
import { readTraits } from "./trait-read.js"

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

function at(parts: Parts, slide: string, shape: string) {
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, slide, part, shape }
}

function exported(parts: Parts, node: ReturnType<typeof at>["node"], patch: ElementPatch): Parts {
  const index = indexPackage(parts)
  const opened: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, v: format, patch },
  ]
  const register = commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
  return exportParts(parts, register)
}

function text(parts: Parts, part: string): string {
  return decodeUtf8(parts.get(part)!)
}

function changed(before: Parts, after: Parts): readonly string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((name) => {
    const left = before.get(name)
    const right = after.get(name)
    return left === undefined || right === undefined || !sameBytes(left, right)
  })
}

const rocket = iconParts("rocket")

describe("a picture's icon, recolour, opacity and crop export into its blip", () => {
  it("swaps a raster picture for an icon: a PNG fallback blip with the SVG in svgBlip, linked and typed", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    const after = exported(parts, picture.node, { image: { source: { set: "rocket" } } })
    expect(changed(parts, after)).toEqual(["ppt/slides/slide9.xml", "ppt/slides/_rels/slide9.xml.rels"])
    const slide = text(after, picture.part)
    const rels = text(after, "ppt/slides/_rels/slide9.xml.rels")
    expect(rels).toContain('Target="../media/icon-rocket.png"/>')
    expect(rels).toContain('Target="../media/icon-rocket.svg"/>')
    expect(slide).toMatch(
      new RegExp(
        `<a:blip r:embed="rId14"><a:extLst><a:ext uri="${svgExtension}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId15"/></a:ext></a:extLst></a:blip>`.replace(
          /[{}]/g,
          "\\$&",
        ),
      ),
    )
    const types = text(after, "[Content_Types].xml")
    expect(types).toContain('<Default Extension="svg" ContentType="image/svg+xml"/>')
    expect(shownImage(after, picture)).toEqual({ source: "rocket", alpha: 100_000, recolor: { none: true } })
    expect(exportParts(after, openRegister("", "clean"))).toBe(after)
    const painted = paintReader(after)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")
    expect(painted?.image).toMatchObject({ part: rocket.svg, contentType: "image/svg+xml" })
    const filled = withMedia(after, (part) => (part === rocket.svg ? encodeUtf8("<svg/>") : undefined))
    expect(decodeUtf8(filled.get(rocket.svg)!)).toBe("<svg/>")
    expect(filled.has(rocket.png)).toBe(false)
    expect(readTraits(after).elements.get(picture.node)?.reads["image.source"]).toEqual({ value: "rocket" })
  })

  it("writes grayscale, a duotone and an opacity as blip effects, and takes them away again", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    const dark = { scheme: "accent1" } as const
    const light = { rgb: "FFFFFF" } as const
    const gray = exported(parts, picture.node, {
      image: { recolor: { set: { grayscale: true } }, alpha: { set: 60_000 as Alpha } },
    })
    expect(text(gray, picture.part)).toContain(
      '<a:blip r:embed="rId9"><a:alphaModFix amt="60000"/><a:grayscl/></a:blip>',
    )
    expect(shownImage(gray, picture)).toEqual({ source: null, alpha: 60_000, recolor: { grayscale: true } })
    const duotone = exported(gray, picture.node, { image: { recolor: { set: { duotone: { dark, light } } } } })
    expect(text(duotone, picture.part)).toContain(
      '<a:blip r:embed="rId9"><a:alphaModFix amt="60000"/><a:duotone><a:schemeClr val="accent1"/><a:srgbClr val="FFFFFF"/></a:duotone></a:blip>',
    )
    const painted = paintReader(duotone)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")?.image
    expect(painted?.alpha).toBe(0.6)
    expect(painted?.recolor).toEqual({
      duotone: [
        { hex: expect.any(String), alpha: 1 },
        { hex: "FFFFFF", alpha: 1 },
      ],
    })
    const plain = exported(duotone, picture.node, {
      image: { recolor: { set: { none: true } }, alpha: { set: 100_000 as Alpha } },
    })
    expect(text(plain, picture.part)).toContain('<a:blip r:embed="rId9"/>')
    expect(text(plain, picture.part)).toBe(text(parts, picture.part))
  })

  it("crops each side in thousandths of a percent and removes the source rectangle at zero", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    expect(shownCrop(parts, picture)).toEqual({ l: 0, t: 0, r: 0, b: 0 })
    const cropped = exported(parts, picture.node, { crop: { rect: { set: { l: 10_000, t: 0, r: 20_000, b: 5_000 } } } })
    expect(text(cropped, picture.part)).toContain(
      '<p:blipFill><a:blip r:embed="rId9"/><a:srcRect l="10000" r="20000" b="5000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>',
    )
    expect(shownCrop(cropped, picture)).toEqual({ l: 10_000, t: 0, r: 20_000, b: 5_000 })
    const painted = paintReader(cropped)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")?.image
    expect(painted?.crop).toEqual({ left: 0.1, top: 0, right: 0.2, bottom: 0.05 })
    const back = exported(cropped, picture.node, { crop: { rect: { set: { l: 0, t: 0, r: 0, b: 0 } } } })
    expect(text(back, picture.part)).toBe(text(parts, picture.part))
  })
})

describe("an element's name, alt text and hidden flag export onto its p:cNvPr", () => {
  it("writes each attribute escaped, keeps line breaks, and removes alt text and hidden when cleared", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    expect(shownIdentity(parts, picture)).toEqual({
      name: "Picture 9",
      alt: "Diagram\n\nDescription automatically generated",
      hidden: false,
    })
    const named = exported(parts, picture.node, {
      identity: { name: { set: 'Heat & "pump"' }, alt: { set: "Line one\nLine two" }, hidden: { set: true } },
    })
    expect(text(named, picture.part)).toContain(
      '<p:cNvPr id="13" name="Heat &amp; &quot;pump&quot;" descr="Line one&#xA;Line two" hidden="1">',
    )
    expect(shownIdentity(named, picture)).toEqual({ name: 'Heat & "pump"', alt: "Line one\nLine two", hidden: true })
    expect(
      paintReader(named)
        .slide(picture.part)
        .elements.some((each) => each.shape === "13"),
    ).toBe(false)
    const cleared = exported(named, picture.node, { identity: { alt: { set: "" }, hidden: { set: false } } })
    expect(text(cleared, picture.part)).toContain('<p:cNvPr id="13" name="Heat &amp; &quot;pump&quot;">')
    const painted = paintReader(cleared)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")
    expect(painted).toMatchObject({ name: 'Heat & "pump"' })
    expect(painted?.alt).toBeUndefined()
  })
})

describe("a shape's fill takes an icon as a picture fill", () => {
  it("writes a blipFill with the icon and reads the icon back as the fill", async () => {
    const parts = await deck("clean.pptx")
    const shape = at(parts, readSlides(parts)[0]!.slide, "2")
    const after = exported(parts, shape.node, { fill: { value: { set: { picture: "rocket" } } } })
    const slide = text(after, shape.part)
    expect(slide).toContain('<a:blipFill rotWithShape="1"><a:blip r:embed="rId2"><a:extLst>')
    expect(slide).toContain("<a:stretch><a:fillRect/></a:stretch></a:blipFill>")
    expect(shownFill(after, shape)).toEqual({ value: { picture: "rocket" }, own: true })
    expect(text(parts, "[Content_Types].xml")).not.toContain('Extension="svg"')
    expect(text(after, "[Content_Types].xml")).toContain('<Default Extension="svg" ContentType="image/svg+xml"/>')
    const painted = paintReader(after)
      .slide(shape.part)
      .elements.find((each) => each.shape === "2")
    expect(painted?.fill).toMatchObject({ type: "picture", part: rocket.svg })
  })
})

describe("a picture added with an icon opening", () => {
  it("writes a p:pic whose blip is the icon's PNG with its SVG beside it, and export keeps it", async () => {
    const parts = await deck("clean.pptx")
    const slide = readSlides(parts)[0]!
    const id = slideId(slide.slide)
    const node = elementId(`${slide.slide}.${String(freeShapeId(parts, slide.part))}`)
    const opening = { image: { source: { set: "rocket" } } }
    const element = {
      node,
      kind: "picture",
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
