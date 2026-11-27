import { readdirSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Guide, Piece, Style, StyleText } from "./index.js"

const beforeTheMerge = [
  { name: "architecture", size: { w: 1680, h: 640 } },
  { name: "bar-chart", size: { w: 1680, h: 620 } },
  { name: "column-chart", size: { w: 1680, h: 620 } },
  { name: "comparison", size: { w: 1680, h: 254 } },
  { name: "donut-chart", size: { w: 1080, h: 620 } },
  { name: "kpi", size: { w: 480, h: 213 } },
  { name: "line-chart", size: { w: 1680, h: 620 } },
  { name: "process-flow", size: { w: 1680, h: 295 } },
  { name: "source-line", size: { w: 1680, h: 31 } },
  { name: "table", size: { w: 1680, h: 544 } },
  { name: "timeline-step", size: { w: 420, h: 216 } },
  { name: "title-block", size: { w: 1680, h: 121 } },
]

const refused = (name: string) => () => {
  throw new Error(`${name} loaded at import`)
}

afterEach(() => {
  vi.doUnmock("node:fs")
  vi.doUnmock("node:path")
  vi.doUnmock("node:url")
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("the taste entry", () => {
  it("lists with a plural, reads with a singular and looks back with Of, and nothing else", async () => {
    const taste = await import("./index.js")
    expect(Object.keys(taste).sort()).toEqual([
      "guide",
      "guides",
      "newDeckTheme",
      "piece",
      "pieces",
      "problemRules",
      "style",
      "styleOf",
      "styleText",
      "styles",
    ])
    const named: readonly [Guide | undefined, Piece | undefined, Style | undefined, StyleText | undefined] = [
      taste.guide("slides"),
      taste.piece("kpi"),
      taste.style("neutral"),
      taste.styleText("neutral"),
    ]
    expect(named.every((each) => each !== undefined)).toBe(true)
  })

  it("pairs every style's theme file with its text file", () => {
    const named = (extension: string) =>
      readdirSync(new URL("../files/styles", import.meta.url))
        .filter((file) => file.endsWith(extension))
        .map((file) => file.slice(0, -extension.length))
        .sort()
    expect(named(".json")).toEqual(named(".md"))
    expect(named(".json").length).toBeGreaterThan(0)
  })

  it("gives the browser its styles without loading a node builtin", async () => {
    vi.resetModules()
    vi.doMock("node:fs", refused("node:fs"))
    vi.doMock("node:path", refused("node:path"))
    vi.doMock("node:url", refused("node:url"))
    const builtin = vi.spyOn(process, "getBuiltinModule")
    const taste = await import("./index.js")
    expect(taste.styles.length).toBeGreaterThan(0)
    expect(builtin).not.toHaveBeenCalled()
  })

  it("reads every kit piece with the name and size it had in the kit package", async () => {
    const { pieces, piece } = await import("./index.js")
    expect(pieces().map(({ name, size }) => ({ name, size }))).toEqual(beforeTheMerge)
    for (const { name, size } of beforeTheMerge) expect(piece(name)?.size).toEqual(size)
  })
})
