import { afterEach, describe, expect, it, vi } from "vitest"
import { collapsedSections, keepCollapsed, keptCollapsed } from "@/editor/collapsed-sections"

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

describe("kept collapsed sections", () => {
  it("keeps the collapsed sections of each deck apart and opens a deck it never saw with every section open", () => {
    vi.stubGlobal("localStorage", shelf())
    expect([...keptCollapsed("one")]).toEqual([])
    keepCollapsed("one", new Set([2, 0]))
    expect([...keptCollapsed("one")].sort()).toEqual([0, 2])
    expect([...keptCollapsed("two")]).toEqual([])
  })

  it("opens every section when the stored value is not a list of section numbers or storage is refused", () => {
    const kept = shelf()
    kept.setItem("airdesign.collapsed-sections.one", '[0,"x",-1,1.5]')
    kept.setItem("airdesign.collapsed-sections.two", "{")
    vi.stubGlobal("localStorage", kept)
    expect([...keptCollapsed("one")]).toEqual([0])
    expect([...keptCollapsed("two")]).toEqual([])
    vi.stubGlobal("localStorage", undefined)
    expect([...keptCollapsed("one")]).toEqual([])
    expect(() => keepCollapsed("one", new Set([1]))).not.toThrow()
  })
})

describe("collapsed sections", () => {
  const sections = [
    { name: "Opening", start: 0 },
    { name: "Numbers", start: 2 },
    { name: "Close", start: 5 },
  ]

  it("keeps the section that holds the current slide open and drops numbers the deck has no section for", () => {
    expect([...collapsedSections(new Set([0, 1, 7]), sections, 3)]).toEqual([0])
    expect([...collapsedSections(new Set([0, 1, 7]), sections, 6)]).toEqual([0, 1])
    expect([...collapsedSections(new Set([0]), [], 0)]).toEqual([])
  })
})
