import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ArrowMarker } from "./arrow-marker.js"
import { swatches } from "./testing/swatches-art.js"

describe("ArrowMarker", () => {
  const head = (kind: "arrow" | "triangle" | "circle") =>
    renderToStaticMarkup(
      createElement("svg", null, createElement(ArrowMarker, { id: "head", kind, color: swatches.black, weight: 10 })),
    )

  it("draws an open arrow head as heavy as its line, its arms at 45 degrees", () => {
    expect(head("arrow")).not.toContain("viewBox")
    expect(head("arrow")).toContain('refX="32" refY="32"')
    expect(head("arrow")).toContain('d="M0 0L32 32L0 64"')
    expect(head("arrow")).toContain('stroke-width="10"')
    expect(head("arrow")).toContain('stroke-linejoin="round"')
  })

  it("draws a closed arrow head whose rounded tip covers the line's round end", () => {
    const corner = 3
    const tipPastEnd = 37 - 33
    const halfAngleSine = 21.5 / Math.hypot(37, 21.5)
    expect(head("triangle")).toContain('refX="33" refY="21.5"')
    expect(head("triangle")).toContain('d="M0 0L37 21.5L0 43Z"')
    expect(head("triangle")).toContain('stroke-width="6"')
    expect(tipPastEnd * halfAngleSine + corner).toBeGreaterThanOrEqual(5)
  })

  it("draws a round end as a circle centred on the line's end", () => {
    expect(head("circle")).toContain('refX="20" refY="20"')
    expect(head("circle")).toContain('<circle cx="20" cy="20" r="20"')
  })
})
