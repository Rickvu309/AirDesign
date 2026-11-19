import { expect, it } from "vitest"
import { kindInstructions } from "./kind-refusal.js"

it("tells the agent a photo is a shape whose fills hold an image, and how to add a Lucide icon and its alt text", () => {
  const instructions = kindInstructions()
  expect(instructions).toContain("fills (paint, source, mode, crop, recolor, overlay, blur)")
  expect(instructions).toContain("A photo or an icon is a shape whose fills hold an image")
  expect(instructions).not.toContain("kind picture")
  expect(instructions).toContain('{ "op": "add", "kind": "shape", "slide": ..., "icon": "rocket" }')
  expect(instructions).toContain("an unknown name is refused with close names")
  expect(instructions).toContain("fades the layer's fill, border, text and image together")
})

it("gives the run format of a JSON text value, how a connector's ends attach", () => {
  const instructions = kindInstructions()
  expect(instructions).toContain("A run may set bold, italic, underline or strike to true or false")
  expect(instructions).toContain("size in hundredths of a point from 100 to 400000")
  expect(instructions).toContain("align to left, center or right, and list to none, bullets or numbers")
  expect(instructions).not.toContain("A JSON table value is")
  expect(instructions).toContain('attaches each end with { "shape": { "node": ..., "site": ... } }')
  expect(instructions).toContain(
    "join, head, tail), effects (shadow, innerShadow, drop1, drop2, drop3, inner1, inner2, inner3, glow, softEdge, blur), connection (start, end) and opacity.",
  )
  expect(instructions).toContain(
    "a rectangle, rounded rectangle, diamond or image has 0 top, 1 left, 2 bottom and 3 right",
  )
})
