import { decide, limits, openRegister, slideId, type Register, type SlideCommand } from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts, missingPictures } from "./exported-parts"
import { pictureCommand, pictureRefusal, pictureType, placedPicture } from "./picture-add"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

const slide = { width: 12_192_000, height: 6_858_000 }
const media = { sha256: "c".repeat(64), type: "image/png" } as const
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])
const gif = xml("GIF89a\u0000")
const svg = xml("<svg xmlns='http://www.w3.org/2000/svg'/>")

function landed(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const decision = decide(register, { command: "slide", file: [slideId("256")], edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("reads PNG, JPEG and GIF from their bytes, whatever the file claims, and nothing else", () => {
  expect(pictureType(png)).toBe("image/png")
  expect(pictureType(jpeg)).toBe("image/jpeg")
  expect(pictureType(gif)).toBe("image/gif")
  expect(pictureType(svg)).toBeNull()
  expect(pictureType(xml("not a picture"))).toBeNull()
})

it("refuses a file of another type and a picture at or over the media limit", () => {
  expect(pictureRefusal(png)).toBeNull()
  expect(pictureRefusal(svg)).toBe("type")
  const large = new Uint8Array(limits.media)
  large.set(png)
  expect(pictureRefusal(large)).toBe("size")
})

it("places a picture at its natural size, centred, and scales a large one down to fit with a margin", () => {
  expect(placedPicture({ width: 480, height: 320 }, slide)).toEqual({
    x: 3_810_000,
    y: 1_905_000,
    cx: 4_572_000,
    cy: 3_048_000,
  })
  const large = placedPicture({ width: 4000, height: 1000 }, slide)
  expect(large.cx / large.cy).toBeCloseTo(4, 3)
  expect(large.cx).toBeLessThanOrEqual(slide.width * 0.9)
  expect(large.x).toBe(Math.round((slide.width - large.cx) / 2))
  const tall = placedPicture({ width: 1000, height: 4000 }, slide)
  expect(tall.cy).toBeLessThanOrEqual(slide.height * 0.9)
  expect(tall.y).toBe(Math.round((slide.height - tall.cy) / 2))
})

it("places a picture in the same clear space as a text box or a table, away from what the slide holds", () => {
  const top = { x: 0, y: 0, width: slide.width, height: slide.height / 2, rotation: 0, flipH: false, flipV: false }
  const placed = placedPicture({ width: 240, height: 160 }, { ...slide, elements: [{ box: top }] })
  expect(placed).toMatchObject({ cx: 2_286_000, cy: 1_524_000 })
  expect(placed.y).toBeGreaterThanOrEqual(slide.height / 2)
})

it("places a picture on a new title slide clear of the empty title and subtitle, smaller and at its ratio", () => {
  const box = (y: number) => ({
    x: 914_400,
    y,
    width: 10_363_200,
    height: 1_371_600,
    rotation: 0,
    flipH: false,
    flipV: false,
  })
  const title = box(1_828_800)
  const subtitle = box(3_429_000)
  const placed = placedPicture({ width: 480, height: 320 }, { ...slide, elements: [{ box: title }, { box: subtitle }] })
  expect(placed.y).toBeGreaterThanOrEqual(subtitle.y + subtitle.height)
  expect(placed.y + placed.cy).toBeLessThanOrEqual(slide.height)
  expect(placed.cx / placed.cy).toBeCloseTo(1.5, 2)
})

it("adds the picture under the next free id with its hash and media type, and export refuses it until its bytes are here", () => {
  const parts = onSlide(xml(twoBoxSlide))
  parts.set(
    "[Content_Types].xml",
    xml(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    ),
  )
  const box = { x: 10, y: 20, cx: 300, cy: 200 }
  const added = pictureCommand(parts, openRegister("", ""), 0, { media }, box)
  expect(added).toEqual({
    slide: "element-add",
    id: "256",
    element: { node: "256.4", kind: "shape", value: null, box, grouped: false },
    media,
  })
  const register = landed(openRegister("", ""), added)
  expect(missingPictures(register, new Map())).toEqual([media.sha256])
  const bytes = new Map([[media.sha256, png]])
  expect(missingPictures(register, bytes)).toEqual([])
  const shown = exportedParts(parts, register, bytes)
  expect(readShapes(shown).map((shape) => shape.kind)).toEqual(["p:sp", "p:sp", "p:pic"])
  expect([...shown.keys()].filter((name) => name.startsWith("ppt/media/"))).toHaveLength(1)
  expect(pictureCommand(parts, openRegister("", ""), 3, { media }, box)).toBeNull()
})
