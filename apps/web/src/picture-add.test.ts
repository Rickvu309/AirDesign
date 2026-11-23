import { decide, openRegister, slideId, type Register, type SlideCommand } from "@airdesign/document"
import { limits } from "@airdesign/doom"
import { readShapes } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts, missingPictures } from "./editing/exported-parts"
import { pictureCommand, pictureRefusal } from "./picture-add"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

const media = { sha256: "c".repeat(64), type: "image/png" } as const
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
const svg = xml("<svg xmlns='http://www.w3.org/2000/svg'/>")

function landed(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const decision = decide(register, { command: "slide", file: [slideId("256")], edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("refuses a file of another type and a picture at or over the media limit", () => {
  expect(pictureRefusal(png)).toBeNull()
  expect(pictureRefusal(svg)).toBe("type")
  const large = new Uint8Array(limits.media)
  large.set(png)
  expect(pictureRefusal(large)).toBe("size")
  const huge = new Uint8Array(24)
  huge.set(png.subarray(0, 8))
  new DataView(huge.buffer).setUint32(16, 30_000)
  new DataView(huge.buffer).setUint32(20, 30_000)
  expect(pictureRefusal(huge)).toBe("size")
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
