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
    expect(unshownText(row({ image: emf }), () => null)).toBe("EMF picture can't be shown here")
  })

  it("says nothing of a picture that drew", () => {
    expect(unshownText(row({ image: png }), () => "blob:1")).toBeNull()
  })

  it("names a picture whose file the deck does not hold", () => {
    expect(unshownText(row({ image: png }), () => null)).toBe("PNG picture can't be shown here")
  })

  it("says a chart or diagram frame is not shown", () => {
    expect(unshownText(row({ kind: "p:graphicFrame" }), () => null)).toBe("Chart or diagram can't be shown here")
  })

  it("says nothing of a frame that is a table", () => {
    expect(
      unshownText(row({ kind: "p:graphicFrame", table: { rows: [] } as unknown as PaintElement["table"] }), () => null),
    ).toBeNull()
  })

  it("says nothing of text and shapes", () => {
    expect(unshownText(row({ kind: "p:sp" }), () => null)).toBeNull()
  })
})
