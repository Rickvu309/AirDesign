import { expect, it } from "vitest"
import { kindInstructions } from "./kind-refusal.js"

it("tells the agent what a picture takes and how to add a Lucide icon and its alt text", () => {
  const instructions = kindInstructions()
  expect(instructions).toContain(
    "A picture takes identity (name, alt, hidden), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape), line (fill, width, dash, cap, compound, join, head, tail), effects (shadow, glow, softEdge), image (mode, source, recolor), crop (rect) and opacity.",
  )
  expect(instructions).toContain('{ "op": "add", "kind": "picture", "slide": ..., "icon": "rocket" }')
  expect(instructions).toContain("an unknown name is refused with close names")
  expect(instructions).toContain("fades the element's fill, line, text and picture together")
})

it("gives the run format of a JSON text value, how a connector's ends attach", () => {
  const instructions = kindInstructions()
  expect(instructions).toContain("A run may set bold, italic, underline or strike to true or false")
  expect(instructions).toContain("size in hundredths of a point from 100 to 400000")
  expect(instructions).toContain("align to left, center or right, and list to none, bullets or numbers")
  expect(instructions).not.toContain("A JSON table value is")
  expect(instructions).toContain('attaches each end with { "shape": { "node": ..., "site": ... } }')
  expect(instructions).toContain(
    "join, head, tail), effects (shadow, glow, softEdge), connection (start, end) and opacity.",
  )
  expect(instructions).toContain(
    "a rectangle, rounded rectangle, diamond or picture has 0 top, 1 left, 2 bottom and 3 right",
  )
})
