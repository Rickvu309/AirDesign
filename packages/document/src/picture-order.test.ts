import { describe, expect, it } from "vitest"
import {
  addedPictures,
  decide,
  elementId,
  mediaTypes,
  openRegister,
  openingElement,
  readSlideState,
  slideId,
  type IndexElement,
  type Register,
  type SlideCommand,
} from "./index.js"
import { limits } from "@airdesign/doom"

const file = [slideId("256"), slideId("257")]
const node = elementId("256.9")
const box = { x: 100, y: 200, cx: 3000, cy: 2000 }
const sha256 = "a".repeat(64)
const picture: IndexElement = { node, kind: "shape", value: null, box, grouped: false }
const media = { sha256, type: "image/png" } as const

function slide(register: Register, edit: SlideCommand) {
  return decide(register, { command: "slide", file, edit })
}

describe("picture order", () => {
  it("adds a picture that names its bytes by hash and media type, and opens it with its box", () => {
    const decision = slide(openRegister("", ""), { slide: "element-add", id: file[0]!, element: picture, media })
    if (decision.decision !== "apply") throw new Error(decision.code)
    expect(openingElement(decision.register, node)).toEqual(picture)
    expect(addedPictures(decision.register)).toEqual([media])
  })

  it("refuses a picture without media, a text box with media, text, a group or a box with no size", () => {
    const refused = (element: IndexElement, withMedia: typeof media | null = media) =>
      slide(openRegister("", ""), {
        slide: "element-add",
        id: file[0]!,
        element,
        ...(withMedia === null ? {} : { media: withMedia }),
      }).decision === "refuse"
    expect(refused(picture, null)).toBe(true)
    expect(refused({ ...picture, kind: "shape", value: "" })).toBe(true)
    expect(refused({ ...picture, value: "" })).toBe(true)
    expect(refused({ ...picture, grouped: true })).toBe(true)
    expect(refused({ ...picture, box: null })).toBe(true)
    expect(refused({ ...picture, box: { ...box, cx: 0 } })).toBe(true)
    expect(refused(picture)).toBe(false)
  })

  it("reads a picture add back from stored rows and refuses a bad hash or a media type export cannot write", () => {
    const row = { slide: "element-add", id: "256", element: picture, media }
    expect(readSlideState({ file, order: [row] })?.order).toEqual([row])
    expect(readSlideState({ file, order: [{ ...row, media: { ...media, sha256: "A".repeat(64) } }] })).toBeUndefined()
    expect(readSlideState({ file, order: [{ ...row, media: { ...media, sha256: "a" } }] })).toBeUndefined()
    expect(readSlideState({ file, order: [{ ...row, media: { ...media, type: "image/svg+xml" } }] })).toBeUndefined()
    expect(readSlideState({ file, order: [{ ...row, media: { ...media, extra: 1 } }] })).toBeUndefined()
  })

  it("lists each picture's bytes once even when two pictures share them", () => {
    const first = slide(openRegister("", ""), { slide: "element-add", id: file[0]!, element: picture, media })
    if (first.decision !== "apply") throw new Error(first.code)
    const second = slide(first.register, {
      slide: "element-add",
      id: file[1]!,
      element: { ...picture, node: elementId("257.4") },
      media,
    })
    if (second.decision !== "apply") throw new Error(second.code)
    expect(addedPictures(second.register)).toEqual([media])
  })

  it("accepts PNG, JPEG and GIF and keeps one picture under its own limit", () => {
    expect(mediaTypes).toEqual(["image/png", "image/jpeg", "image/gif"])
    expect(limits.media).toBe(10_000_000)
    expect(limits.media).toBeLessThan(limits.bytes)
  })
})
