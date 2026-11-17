import { afterEach, describe, expect, it, vi } from "vitest"
import { gridLayout, keepGridZoom, keptGridZoom } from "@/editor/grid-zoom"

const wide = { width: 12_192_000, height: 6_858_000 }

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

describe("grid percent", () => {
  it("uses the slide percent without changing rows or clamping to the window", () => {
    expect(gridLayout(25, wide, 50)).toEqual({ columns: 9, width: 320 })
    expect(gridLayout(50, wide, 50)).toEqual({ columns: 9, width: 640 })
    expect(gridLayout(200, wide, 50)).toEqual({ columns: 9, width: 2560 })
  })
})

describe("kept grid zoom", () => {
  it("keeps the zoom for each deck apart and opens a deck it never saw at Zoom to fit", () => {
    vi.stubGlobal("localStorage", shelf())
    expect(keptGridZoom("one")).toBe("fit")
    keepGridZoom("one", 25)
    expect(keptGridZoom("one")).toBe(25)
    expect(keptGridZoom("two")).toBe("fit")
    keepGridZoom("one", 23.75)
    expect(keptGridZoom("one")).toBe(23.75)
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
