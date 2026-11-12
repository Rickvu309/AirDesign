import { describe, expect, it } from "vitest"
import {
  hoverFindings,
  safeAreaFindings,
  themeColorFindings,
  themeColorFor,
  viewportFindings,
  viewportHeightFindings,
  viewportReachFindings,
} from "./site-rules.ts"

const viewport = (content: string) => `<meta name="viewport" content="${content}">`
const good = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"

describe("viewport", () => {
  it("accepts the phone baseline", () => {
    expect(viewportFindings(viewport(good))).toEqual([])
    expect(viewportReachFindings(viewport(good))).toEqual([])
  })

  it("refuses a viewport that turns zoom off or caps it", () => {
    expect(viewportFindings(viewport(`${good}, user-scalable=no`))).toHaveLength(1)
    expect(viewportFindings(viewport(`${good}, maximum-scale=1`))).toHaveLength(1)
    expect(viewportFindings(viewport(`${good}, user-scalable = 0`))).toHaveLength(1)
  })

  it("names a page with no viewport, and one that does not reach under the notch or resize with the keyboard", () => {
    expect(viewportFindings("<head></head>")).toEqual(["no viewport meta"])
    expect(viewportReachFindings(viewport("width=device-width, initial-scale=1"))).toHaveLength(2)
  })
})

describe("theme-color", () => {
  const light = '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">'
  const dark = '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a">'

  it("accepts one tag for each scheme and reads each", () => {
    expect(themeColorFindings(`${light}${dark}`)).toEqual([])
    expect(themeColorFor(`${light}${dark}`, "dark")).toBe("#0a0a0a")
  })

  it("refuses one tag for both schemes, and a scheme with none", () => {
    expect(themeColorFindings('<meta name="theme-color" content="#ffffff">')).toContain(
      "a theme-color has no prefers-color-scheme media",
    )
    expect(themeColorFindings(light)).toEqual(["no theme-color for the dark scheme"])
    expect(themeColorFindings("")).toEqual(["no theme-color meta"])
  })
})

describe("hover", () => {
  const gated = "@media (hover: hover) and (pointer: fine) { .a:hover { color: red } }"

  it("accepts a hover rule inside the hover media query", () => {
    expect(hoverFindings(gated)).toEqual([])
    expect(hoverFindings("@media (hover:hover) and (pointer:fine){.a:hover{color:red}}")).toEqual([])
  })

  it("refuses a bare hover rule, one gated on hover alone, and one inside another media query", () => {
    expect(hoverFindings(".a:hover { color: red }")).toHaveLength(1)
    expect(hoverFindings("@media (hover: hover) { .a:hover { color: red } }")).toHaveLength(1)
    expect(hoverFindings("@media (min-width: 640px) { .a:hover { color: red } }")).toHaveLength(1)
    expect(hoverFindings(".a:hover, .b { color: red }")).toHaveLength(1)
  })
})

describe("viewport height", () => {
  it("refuses 100vh in a page or its css and accepts the small and dynamic units", () => {
    expect(viewportHeightFindings("", ".hero{min-height:100vh}")).toHaveLength(1)
    expect(viewportHeightFindings('<div style="height: 100vh">', "")).toHaveLength(1)
    expect(viewportHeightFindings("", ".hero{min-height:100svh}.app{height:100dvh}")).toEqual([])
  })
})

describe("safe area", () => {
  it("refuses an inset without viewport-fit=cover and accepts it with", () => {
    const css = ".bar{padding-bottom:env(safe-area-inset-bottom,0px)}"
    expect(safeAreaFindings(viewport("width=device-width, initial-scale=1"), css)).toHaveLength(1)
    expect(safeAreaFindings(viewport(good), css)).toEqual([])
    expect(safeAreaFindings(viewport("width=device-width"), ".bar{color:red}")).toEqual([])
  })
})
