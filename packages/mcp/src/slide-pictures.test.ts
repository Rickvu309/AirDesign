import { openRegister, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { pictureBlocks, pictureWords, picturesPerRead } from "./slide-pictures.js"

const slides = Array.from({ length: 12 }, (_, at) => slideId(String(256 + at)))
const register = {
  ...openRegister("", "deck"),
  index: {
    slides: slides.map((id, position) => ({
      id,
      position,
      size: { width: 12192000, height: 6858000 },
      free: 40,
      animated: [],
      layout: [],
    })),
  },
} as unknown as ReturnType<typeof openRegister>

const shot = (revision: number) => ({ revision, data: "aGVsbG8=" })

it("labels each picture with its slide and revision, and says what it left out", () => {
  const shots = new Map(slides.slice(0, 9).map((id) => [id, shot(4)]))
  const blocks = pictureBlocks({ state: "painted", shots }, register, undefined, 4)
  expect(blocks.filter((block) => block.type === "image")).toHaveLength(9)
  expect(blocks[0]).toEqual({ type: "text", text: "Slide 1 (256) at revision 4:" })
  expect(blocks[1]).toEqual({ type: "image", data: "aGVsbG8=", mimeType: "image/jpeg" })
  expect(blocks.at(-2)).toEqual({ type: "text", text: pictureWords.behind([String(slides[9])], 4) })
  expect(blocks.at(-1)).toEqual({ type: "text", text: pictureWords.more(picturesPerRead, 12) })
})

it("shows one slide when the read names it", () => {
  const target = slides[11]
  if (target === undefined) throw new Error("slide")
  const blocks = pictureBlocks({ state: "painted", shots: new Map([[target, shot(7)]]) }, register, target, 7)
  expect(blocks).toEqual([
    { type: "text", text: "Slide 12 (267) at revision 7:" },
    { type: "image", data: "aGVsbG8=", mimeType: "image/jpeg" },
  ])
})

it("tells the agent what to do when no picture can be painted", () => {
  expect(pictureBlocks(undefined, register, undefined, 1)).toEqual([{ type: "text", text: pictureWords.closed }])
  expect(pictureBlocks({ state: "idle" }, register, undefined, 1)).toEqual([{ type: "text", text: pictureWords.idle }])
})
