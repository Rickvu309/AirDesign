declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { elementId, orderKeyBetween, slideId, type Media, type SlideState } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8 } from "./package-bytes.js"
import { shownPictureMode } from "./picture-mode.js"
import {
  danglingShapeReferences,
  orderedParts,
  paintReader,
  readParts,
  readShapes,
  readSlides,
  sharedOwnedParts,
} from "./index.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const box = { x: 914400, y: 685800, cx: 2743200, cy: 1828800 }
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6])
const pngMedia: Media = { sha256: "a1".repeat(32), type: "image/png" }
const jpegMedia: Media = { sha256: "b2".repeat(32), type: "image/jpeg" }

async function fixture(name: string) {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
}

function pictureAdd(slide: string, shape: number, media: Media) {
  const node = elementId(`${slide}.${String(shape)}`)
  return {
    slide: "element-add" as const,
    id: slideId(slide),
    element: { node, kind: "shape" as const, value: null, box, grouped: false },
    media,
  }
}

function changedNames(before: ReadonlyMap<string, Uint8Array>, after: ReadonlyMap<string, Uint8Array>): string[] {
  const names = new Set([...before.keys(), ...after.keys()])
  return [...names].filter((name) => {
    const left = before.get(name)
    const right = after.get(name)
    return (
      left === undefined || right === undefined || left.length !== right.length || left.some((b, i) => b !== right[i])
    )
  })
}

function bytesOf(sha256: string): Uint8Array | undefined {
  if (sha256 === pngMedia.sha256) return png
  if (sha256 === jpegMedia.sha256) return jpeg
  return undefined
}

function text(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return decodeUtf8(bytes)
}

it("writes an added PNG as a p:pic with its media part, slide relationship and content type, and changes nothing else", async () => {
  const original = await fixture("clean.pptx")
  const state: SlideState = { file: [slideId("256")], order: [pictureAdd("256", 9, pngMedia)] }
  const changed = orderedParts(original, state, bytesOf)
  const media = `ppt/media/picture-${"a1".repeat(8)}.png`
  expect(changedNames(original, changed).sort()).toEqual(
    ["[Content_Types].xml", media, "ppt/slides/_rels/slide1.xml.rels", "ppt/slides/slide1.xml"].sort(),
  )
  expect(changed.get(media)).toEqual(png)
  expect(text(changed, "[Content_Types].xml")).toContain('<Default Extension="png" ContentType="image/png"/>')
  expect(text(changed, "ppt/slides/_rels/slide1.xml.rels")).toContain(
    'Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/picture-',
  )
  expect(readShapes(changed).find((shape) => shape.shape === "9")).toMatchObject({ kind: "p:pic", box })
  const painted = paintReader(changed)
    .slide("ppt/slides/slide1.xml")
    .elements.find((element) => element.shape === "9")
  expect(painted?.image).toMatchObject({ part: media, contentType: "image/png" })
  expect(danglingShapeReferences(changed)).toEqual(danglingShapeReferences(original))
})

it("names the media part so it collides with no picture the deck already holds, and adds no content type it has", async () => {
  const original = await fixture("nasa-1d-cnn.pptx")
  const slides = readSlides(original).map((each) => slideId(each.slide))
  const state: SlideState = { file: slides, order: [pictureAdd(slides[0]!, 900, jpegMedia)] }
  const before = text(original, "[Content_Types].xml")
  const changed = orderedParts(original, state, bytesOf)
  const added = [...changed.keys()].filter((name) => !original.has(name))
  expect(added).toEqual([`ppt/media/picture-${"b2".repeat(8)}.jpeg`])
  expect(text(changed, "[Content_Types].xml")).toBe(before)
})

it("shares one media part and one relationship between two pictures with the same bytes", async () => {
  const original = await fixture("clean.pptx")
  const state: SlideState = {
    file: [slideId("256")],
    order: [pictureAdd("256", 9, pngMedia), pictureAdd("256", 10, pngMedia)],
  }
  const changed = orderedParts(original, state, bytesOf)
  expect([...changed.keys()].filter((name) => name.startsWith("ppt/media/"))).toHaveLength(1)
  expect(text(changed, "ppt/slides/_rels/slide1.xml.rels").match(/relationships\/image"/g)).toHaveLength(1)
  expect(text(changed, "ppt/slides/slide1.xml").match(/r:embed="rId2"/g)).toHaveLength(2)
})

it("keeps the picture in place without bytes and reports the missing media part as a reference to nothing", async () => {
  const original = await fixture("clean.pptx")
  const state: SlideState = { file: [slideId("256")], order: [pictureAdd("256", 9, pngMedia)] }
  const changed = orderedParts(original, state)
  expect(readShapes(changed).find((shape) => shape.shape === "9")?.kind).toBe("p:pic")
  expect([...changed.keys()].some((name) => name.startsWith("ppt/media/"))).toBe(false)
  const painted = paintReader(changed)
    .slide("ppt/slides/slide1.xml")
    .elements.find((element) => element.shape === "9")
  expect(painted?.image).toMatchObject({ part: `ppt/media/picture-${"a1".repeat(8)}.png`, contentType: "image/png" })
  expect(danglingShapeReferences(changed)).toEqual([
    { part: "ppt/slides/_rels/slide1.xml.rels", kind: "Relationship", id: "rId2" },
  ])
})

it("reports a part whose extension has no content type", async () => {
  const original = await fixture("clean.pptx")
  const broken = new Map(original)
  broken.set("ppt/media/stray.png", png)
  expect(danglingShapeReferences(broken)).toEqual([{ part: "ppt/media/stray.png", kind: "Types", id: "png" }])
})

it("shares the media part with a duplicated slide and drops a removed picture's p:pic", async () => {
  const original = await fixture("clean.pptx")
  const key = orderKeyBetween(orderKeyBetween(null, null), null)
  const state: SlideState = {
    file: [slideId("256")],
    order: [
      pictureAdd("256", 9, pngMedia),
      { slide: "clone", id: slideId("257"), source: slideId("256"), key },
      { slide: "element-remove", id: slideId("256"), node: elementId("256.9") },
    ],
  }
  const changed = orderedParts(original, state, bytesOf)
  const pictures = readShapes(changed).filter((shape) => shape.kind === "p:pic")
  expect(pictures.map((shape) => shape.slide)).toEqual(["257"])
  expect([...changed.keys()].filter((name) => name.startsWith("ppt/media/"))).toHaveLength(1)
  expect(danglingShapeReferences(changed)).toEqual(danglingShapeReferences(original))
  expect(sharedOwnedParts(changed)).toEqual([])
})

async function added(size: { cx: number; cy: number }, bytes: Uint8Array | undefined) {
  const parts = await fixture("clean.pptx")
  const slide = readSlides(parts)[0]!
  const shape = String(readShapes(parts).filter((each) => each.slide === slide.slide).length + 2)
  const node = elementId(`${slide.slide}.${shape}`)
  const media: Media = { sha256: "c3".repeat(32), type: "image/png" }
  const element = { node, kind: "shape", value: null, box: { x: 0, y: 0, ...size }, grouped: false } as const
  const register = {
    file: [slideId(slide.slide)],
    order: [{ slide: "element-add", id: slideId(slide.slide), element, media }],
  } as const
  const after = orderedParts(parts, register, (sha256) => (sha256 === media.sha256 ? bytes : undefined))
  return { after, at: { slide: slide.slide, part: slide.part, shape }, xml: decodeUtf8(after.get(slide.part)!) }
}

it("places a picture a person or an agent adds with Fill, in PowerPoint's native placement, as Figma places a new image", async () => {
  const picture = new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/picture.png`))
  const emu = 9525
  const own = await added({ cx: 480 * emu, cy: 320 * emu }, picture)
  expect(shownPictureMode(own.after, own.at)).toBe("fill")
  expect(own.xml).toContain('<a:stretch><a:fillRect l="0" t="0" r="0" b="0"/></a:stretch>')
  const wide = await added({ cx: 960 * emu, cy: 320 * emu }, picture)
  expect(shownPictureMode(wide.after, wide.at)).toBe("fill")
  expect(wide.xml).toContain('<a:fillRect l="0" t="-50000" r="0" b="-50000"/>')
  const painted = paintReader(wide.after)
    .slide(wide.at.part)
    .elements.find((each) => each.shape === wide.at.shape)
  expect(painted?.image).toMatchObject({ contentType: "image/png" })
})

it("keeps the plain stretch placement for an added picture whose bytes are not on this device", async () => {
  const { xml } = await added({ cx: 914_400, cy: 914_400 }, undefined)
  expect(xml).toContain("<a:stretch><a:fillRect/></a:stretch>")
})
