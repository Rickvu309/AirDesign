import { afterEach, describe, expect, it, vi } from "vitest"
import { gridFit, gridGap, gridSizes, keepGridSize, keptGridSize, steppedGridSize } from "@/editor/grid-size"

function shelf(): Pick<Storage, "getItem" | "setItem"> {
  const held = new Map<string, string>()
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("grid fit", () => {
  it("fills the room with as many columns as the size allows and no gap at the edges", () => {
    const fit = gridFit(1374, 300)
    expect(fit.columns).toBe(4)
    expect(fit.width * fit.columns + gridGap * (fit.columns - 1)).toBeLessThanOrEqual(1374)
    expect(fit.width * fit.columns + gridGap * (fit.columns - 1)).toBeGreaterThan(1374 - fit.columns)
    expect(fit.width).toBeGreaterThanOrEqual(300)
  })

  it("adds columns when the window widens and takes them away when it narrows", () => {
    expect(gridFit(1824, 300).columns).toBe(5)
    expect(gridFit(928, 300).columns).toBe(2)
    expect(gridFit(600, 300).columns).toBe(1)
    expect(gridFit(1374, 600).columns).toBe(2)
  })

  it("keeps one column that shrinks to the room when even one slide does not fit", () => {
    expect(gridFit(200, 300)).toEqual({ columns: 1, width: 200 })
    expect(gridFit(0, 300)).toEqual({ columns: 1, width: 0 })
  })

  it("shows fewer, larger slides at a larger size", () => {
    const sizes = gridSizes.map((size) => gridFit(1374, size).columns)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
    expect(new Set(sizes).size).toBe(gridSizes.length)
  })
})

describe("grid size steps", () => {
  it("steps up and down through the sizes and stops at the ends", () => {
    const smallest = gridSizes[0]
    const largest = gridSizes[gridSizes.length - 1]
    expect(steppedGridSize("in", 300)).toBeGreaterThan(300)
    expect(steppedGridSize("out", 300)).toBeLessThan(300)
    expect(steppedGridSize("in", largest)).toBe(largest)
    expect(steppedGridSize("out", smallest)).toBe(smallest)
    expect(steppedGridSize("fit", smallest)).toBe(300)
  })
})

describe("kept grid size", () => {
  it("keeps the size for each deck apart and opens a deck it never saw at the middle size", () => {
    vi.stubGlobal("localStorage", shelf())
    expect(keptGridSize("one")).toBe(300)
    keepGridSize("one", 420)
    expect(keptGridSize("one")).toBe(420)
    expect(keptGridSize("two")).toBe(300)
  })

  it("opens at the middle size when the stored value is not a size or storage is refused", () => {
    const kept = shelf()
    kept.setItem("airdesign.grid-size.one", "301")
    vi.stubGlobal("localStorage", kept)
    expect(keptGridSize("one")).toBe(300)
    vi.stubGlobal("localStorage", undefined)
    expect(keptGridSize("one")).toBe(300)
    expect(() => keepGridSize("one", 420)).not.toThrow()
  })
})
