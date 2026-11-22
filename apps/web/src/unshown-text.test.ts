import type { PaintElement } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { unshownText } from "./unshown-text"

const whole = { left: 0, top: 0, right: 0, bottom: 0 }

function row(overrides: Partial<PaintElement>): PaintElement {
  return {
    part: "ppt/slides/slide1.xml",
    shape: "4",
    from: "slide",
    kind: "p:pic",
    image: null,
    box: null,
    group: null,
    placeholder: null,
    text: null,
    fill: null,
    ...overrides,
  } as PaintElement
}

const emf = { part: "ppt/media/image3.emf", contentType: "image/x-emf", crop: whole, tile: false }
const png = { part: "ppt/media/image1.png", contentType: "image/png", crop: whole, tile: false }

describe("unshownText", () => {
  it("names the format of a picture the browser cannot draw", () => {
    expect(unshownText(row({ image: emf }), () => null)).toBe("EMF image can't be shown here")
  })

  it("says nothing of a picture that drew", () => {
    expect(unshownText(row({ image: png }), () => "blob:1")).toBeNull()
  })

  it("names a picture whose file the deck does not hold", () => {
    expect(unshownText(row({ image: png }), () => null)).toBe("PNG image can't be shown here")
  })

  it("says an added picture whose bytes have not arrived is still uploading", () => {
    const added = { ...png, part: "ppt/media/picture-0123456789abcdef.png" }
    expect(unshownText(row({ image: added }), () => null)).toBe("Image is still uploading from another device")
    expect(unshownText(row({ image: added }), () => "blob:2")).toBeNull()
  })

  it("says a chart or diagram frame is not shown", () => {
    expect(unshownText(row({ kind: "p:graphicFrame" }), () => null)).toBe("This object can't be shown here")
  })

  it("says nothing of a diagram frame painted from its saved drawing", () => {
    expect(unshownText(row({ kind: "p:graphicFrame", diagram: [] }), () => null)).toBeNull()
  })

  it("says nothing of a chart frame it paints", () => {
    const chart = { kind: "pie" } as unknown as PaintElement["chart"]
    expect(unshownText(row({ kind: "p:graphicFrame", chart }), () => null)).toBeNull()
  })

  it("says nothing of text and shapes", () => {
    expect(unshownText(row({ kind: "p:sp" }), () => null)).toBeNull()
  })
})
