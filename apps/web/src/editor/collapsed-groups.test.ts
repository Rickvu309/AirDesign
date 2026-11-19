import { describe, expect, it } from "vitest"
import { heldGroups } from "@/editor/collapsed-groups"

describe("collapsed sections", () => {
  const sections = [
    { name: "Opening", start: 0, key: "f0" },
    { name: "Numbers", start: 2, key: "f1" },
    { name: "Close", start: 5, key: "f2" },
  ]

  it("keeps a collapsed slide group by its key, so a move that empties another collapses no other group", () => {
    const emptied = [sections[0]!, { ...sections[2]!, start: 2 }]
    expect([...heldGroups(new Set(["f1"]), emptied)]).toEqual([])
    expect([...heldGroups(new Set(["f2"]), emptied)]).toEqual([1])
    const moved = [
      { ...sections[2]!, start: 0 },
      { ...sections[0]!, start: 3 },
      { ...sections[1]!, start: 5 },
    ]
    expect([...heldGroups(new Set(["f2", "f1"]), moved)]).toEqual([0, 2])
  })
})
