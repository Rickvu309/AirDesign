import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { UsageRing } from "./usage-ring"

const circles = (fraction: number) =>
  renderToStaticMarkup(<UsageRing fraction={fraction} />).split("<circle").length - 1

describe("usage ring", () => {
  it("draws only the track when nothing is used, so it never reads as a spinner", () => {
    expect(circles(0)).toBe(1)
  })

  it("draws the arc once something is used", () => {
    expect(circles(0.01)).toBe(2)
    expect(circles(1)).toBe(2)
  })

  it("turns red only when the week's usage is all spent", () => {
    expect(renderToStaticMarkup(<UsageRing fraction={0.99} />)).toContain("var(--primary)")
    expect(renderToStaticMarkup(<UsageRing fraction={1} />)).toContain("var(--destructive)")
  })
})
