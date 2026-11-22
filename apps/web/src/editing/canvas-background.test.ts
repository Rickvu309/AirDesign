import { expect, it } from "vitest"
import { backgroundOf } from "@/editing/canvas-background"
import { cssColor } from "@/editing/paint-css"

const picture = { type: "picture" as const, part: "ppt/media/image1.png", contentType: "image/png", tile: false }
const whole = { left: 0, top: 0, right: 0, bottom: 0 }
const source = () => "blob:background"

it("paints a background picture's transparency over the white slide, as PowerPoint does", () => {
  const veil = cssColor({ hex: "ffffff", alpha: 0.65 })
  expect(veil.slice(-2)).toBe("a6")
  expect(backgroundOf({ ...picture, crop: whole, alpha: 0.35 }, source)).toBe(
    `linear-gradient(${veil}, ${veil}), url("blob:background") 0% 0% / 100% 100% no-repeat, white`,
  )
})

it("paints an opaque background picture as it is", () => {
  expect(backgroundOf({ ...picture, crop: whole }, source)).toBe('url("blob:background") 0% 0% / 100% 100% no-repeat')
})
