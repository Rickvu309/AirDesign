import { afterEach, describe, expect, it, vi } from "vitest"
import { gridFit, gridFitAll, gridGap, gridLayout, keepGridZoom, keptGridZoom } from "@/editor/grid-zoom"

const wide = { width: 12_192_000, height: 6_858_000 }
const plain = { counts: [12], heads: 0, aspect: 9 / 16 }

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
  })

  it("keeps one column that shrinks to the room when even one slide does not fit", () => {
    expect(gridFit(200, 300)).toEqual({ columns: 1, width: 200 })
    expect(gridFit(0, 300)).toEqual({ columns: 1, width: 0 })
  })
})

describe("grid zoom to fit", () => {
  it("draws every slide as large as it can while the whole deck stays in view", () => {
    expect(gridFitAll({ width: 1374, height: 700 }, plain)).toEqual({ columns: 4, width: 319 })
  })

  it("lets the window's height decide when a short deck would grow past it", () => {
    expect(gridFitAll({ width: 1374, height: 600 }, { ...plain, counts: [2] })).toEqual({ columns: 2, width: 671 })
    expect(gridFitAll({ width: 1374, height: 400 }, { ...plain, counts: [1] })).toEqual({ columns: 1, width: 668 })
  })

  it("leaves room for section heads and the gap between sections", () => {
    expect(gridFitAll({ width: 1374, height: 600 }, { ...plain, counts: [2, 2], heads: 2 })).toEqual({
      columns: 2,
      width: 398,
    })
  })

  it("stops at the smallest slide and fills the row when the deck cannot all fit", () => {
    expect(gridFitAll({ width: 1374, height: 700 }, { ...plain, counts: [50] })).toEqual({ columns: 7, width: 168 })
  })
})

describe("grid zoom to a percent", () => {
  it("draws each slide at exactly that percent with as many columns as fit", () => {
    const room = { width: 1374, height: 700 }
    expect(gridLayout(25, room, wide, plain)).toEqual({ columns: 3, width: 320 })
    expect(gridLayout(50, room, wide, plain)).toEqual({ columns: 2, width: 640 })
    expect(gridLayout(10, room, wide, plain)).toEqual({ columns: 8, width: 128 })
  })

  it("holds a slide wider than the room to the room's width", () => {
    expect(gridLayout(200, { width: 1374, height: 700 }, wide, plain)).toEqual({ columns: 1, width: 1374 })
  })

  it("fits the whole deck at Zoom to fit", () => {
    expect(gridLayout("fit", { width: 1374, height: 700 }, wide, plain)).toEqual({ columns: 4, width: 319 })
  })
})

describe("kept grid zoom", () => {
  it("keeps the zoom for each deck apart and opens a deck it never saw at Zoom to fit", () => {
    vi.stubGlobal("localStorage", shelf())
    expect(keptGridZoom("one")).toBe("fit")
    keepGridZoom("one", 25)
    expect(keptGridZoom("one")).toBe(25)
    expect(keptGridZoom("two")).toBe("fit")
    keepGridZoom("one", "fit")
    expect(keptGridZoom("one")).toBe("fit")
  })

  it("opens at Zoom to fit when the stored value is not a percent or storage is refused", () => {
    const kept = shelf()
    kept.setItem("airdesign.grid-zoom.one", "big")
    vi.stubGlobal("localStorage", kept)
    expect(keptGridZoom("one")).toBe("fit")
    kept.setItem("airdesign.grid-zoom.one", "9000")
    expect(keptGridZoom("one")).toBe(400)
    vi.stubGlobal("localStorage", undefined)
    expect(keptGridZoom("one")).toBe("fit")
    expect(() => keepGridZoom("one", 50)).not.toThrow()
  })
})
