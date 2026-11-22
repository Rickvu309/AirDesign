import { expect, it } from "vitest"
import { gradientLook, keptTextFill, paintedColor } from "./text-fill-look.js"

it("clips a multistop gradient to the letters and resolves template colors", () => {
  const look = gradientLook(
    {
      gradient: {
        stops: [
          { pos: 0, color: { rgb: "FF0000" } },
          { pos: 50000, color: { scheme: "accent1" } },
          { pos: 100000, color: { rgb: "0000FF" } },
        ],
        shade: { linear: { angle: 5400000, scaled: true } },
        rotateWithShape: true,
      },
    },
    [{ scheme: "accent1", css: `#${"00FF00"}` }],
  )
  expect(look).toEqual({
    backgroundImage: `linear-gradient(180deg, ${"#"}FF0000 0%, ${"#"}00FF00 50%, ${"#"}0000FF 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
  })
})

it("keeps each gradient stop's opacity", () => {
  const look = gradientLook(
    {
      gradient: {
        stops: [
          { pos: 0, color: { rgb: "FF0000", transforms: [{ op: "alpha", val: 10000 }] } },
          { pos: 100000, color: { rgb: "0000FF" } },
        ],
        shade: { linear: { angle: 0, scaled: false } },
        rotateWithShape: true,
      },
    },
    [],
  )
  expect(look.backgroundImage).toContain(`${"#"}FF00001a`)
})

it("keeps the shown opacity when a new gradient overlays the native run", () => {
  const fill = {
    gradient: {
      stops: [
        { pos: 0, color: { rgb: "FF0000" } },
        { pos: 100000, color: { rgb: "0000FF" } },
      ],
      shade: { linear: { angle: 0, scaled: false } },
      rotateWithShape: true,
    },
  }
  expect(gradientLook(keptTextFill(fill, `${"#"}0000001a`), []).backgroundImage).toContain(`${"#"}FF00001a`)
})

const light = `#${"F4F6FA"}`
const dark = `#${"0E1626"}`
const darkTemplate = [
  { scheme: "dk1", css: dark, mapped: ["bg1"] },
  { scheme: "lt1", css: light, mapped: ["tx1"] },
] as const

it("paints a mapped text colour through the slide's colour map, so text is light on a dark template", () => {
  expect(paintedColor({ scheme: "tx1" }, darkTemplate, null)).toBe(light)
  expect(paintedColor({ scheme: "bg1" }, darkTemplate, null)).toBe(dark)
  expect(paintedColor({ scheme: "dk1" }, darkTemplate, null)).toBe(dark)
})

it("resolves a gradient stop's mapped colour the same way", () => {
  const look = gradientLook(
    {
      gradient: {
        stops: [
          { pos: 0, color: { scheme: "tx1" } },
          { pos: 100000, color: { scheme: "bg1" } },
        ],
        shade: { linear: { angle: 0, scaled: true } },
        rotateWithShape: true,
      },
    },
    darkTemplate,
  )
  expect(look.backgroundImage).toBe(`linear-gradient(90deg, ${light} 0%, ${dark} 100%)`)
})
