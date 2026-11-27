import { afterEach, describe, expect, it, vi } from "vitest"

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
  it("gives the browser its theme presets without loading a node builtin", async () => {
    vi.resetModules()
    vi.doMock("node:fs", refused("node:fs"))
    vi.doMock("node:path", refused("node:path"))
    vi.doMock("node:url", refused("node:url"))
    const builtin = vi.spyOn(process, "getBuiltinModule")
    const skills = await import("./index.js")
    expect(skills.themePresets.length).toBeGreaterThan(0)
    expect(builtin).not.toHaveBeenCalled()
  })

  it("reads every kit piece with the name and size it had in the kit package", async () => {
    const { kitPieces, readKitPiece } = await import("./index.js")
    expect(kitPieces().map(({ name, size }) => ({ name, size }))).toEqual(beforeTheMerge)
    for (const { name, size } of beforeTheMerge) expect(readKitPiece(name)?.size).toEqual(size)
  })
})
