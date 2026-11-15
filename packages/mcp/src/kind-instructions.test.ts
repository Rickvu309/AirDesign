import { expect, it } from "vitest"
import { kindInstructions } from "./kind-refusal.js"

it("tells the agent what a picture takes and how to add a Lucide icon and its alt text", () => {
  const instructions = kindInstructions()
  expect(instructions).toContain(
    "A picture takes identity (name, alt, hidden), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape), line (fill, width, dash, cap, compound, join, head, tail), effects (shadow, glow, softEdge), image (source, recolor), crop (rect) and opacity.",
  )
  expect(instructions).toContain('{ "op": "add", "kind": "picture", "slide": ..., "icon": "rocket" }')
  expect(instructions).toContain("an unknown name is refused with close names")
  expect(instructions).toContain("fades the element's fill, line, text and picture together")
})
