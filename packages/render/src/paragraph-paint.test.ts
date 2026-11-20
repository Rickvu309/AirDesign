import { expect, it } from "vitest"
import { paragraphPaint } from "./paragraph-paint.js"

it("reads every alignment a paragraph can hold, justify included, and leaves an unknown one out", () => {
  for (const align of ["left", "center", "right", "justify"] as const)
    expect(paragraphPaint({ align })).toEqual({ align })
  expect(paragraphPaint({ align: "distributed" })).toEqual({})
})
