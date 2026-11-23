import { describe, expect, it } from "vitest"
import { allDecks, deckPath, decksMatching, recentCount, recentDecks, type ListedDeck } from "./deck-listing"

function deck(id: string, name: string, edited: string, created = "2026-01-01T00:00:00Z"): ListedDeck {
  return { deck: id, name, edited, created }
}

const atlas = deck("a", "Project Atlas", "2026-11-10T10:00:00Z")
const budget = deck("b", "Budget review", "2026-11-11T10:00:00Z")
const board = deck("c", "Board pack, October", "2026-11-09T10:00:00Z")

describe("decksMatching", () => {
  it("keeps every deck for an empty or blank query", () => {
    expect(decksMatching([atlas, budget], "")).toEqual([atlas, budget])
    expect(decksMatching([atlas, budget], "   ")).toEqual([atlas, budget])
  })

  it("matches a part of a name without caring about case", () => {
    expect(decksMatching([atlas, budget, board], "BOARD")).toEqual([board])
    expect(decksMatching([atlas, budget, board], "t a")).toEqual([atlas])
  })

  it("ignores spaces around the query", () => {
    expect(decksMatching([atlas, budget], "  atlas ")).toEqual([atlas])
  })

  it("matches nothing when no name has the query", () => {
    expect(decksMatching([atlas, budget], "quarterly")).toEqual([])
  })

  it("matches letters with accents when typed without them", () => {
    const cafe = deck("d", "Café menu", "2026-11-01T10:00:00Z")
    expect(decksMatching([cafe], "cafe")).toEqual([cafe])
  })
})

describe("allDecks", () => {
  it("puts the most recently edited deck first", () => {
    expect(allDecks([atlas, budget, board])).toEqual([budget, atlas, board])
  })

  it("breaks a tie by creation date, then by id, so the order never shifts", () => {
    const same = "2026-11-11T10:00:00Z"
    const older = deck("z", "Older", same, "2026-01-01T00:00:00Z")
    const newer = deck("y", "Newer", same, "2026-02-01T00:00:00Z")
    const twinA = deck("m", "Twin", same, "2026-01-01T00:00:00Z")
    expect(allDecks([older, newer, twinA])).toEqual([newer, twinA, older])
    expect(allDecks([twinA, newer, older])).toEqual([newer, twinA, older])
  })

  it("leaves the list it was given as it was", () => {
    const given = [atlas, budget]
    allDecks(given)
    expect(given).toEqual([atlas, budget])
  })
})

describe("recentDecks", () => {
  it("shows the most recently edited decks, no more than recentCount", () => {
    const many = Array.from({ length: recentCount + 3 }, (_, index) =>
      deck(`d${index}`, `Deck ${index}`, new Date(Date.UTC(2026, 10, 1 + index)).toISOString()),
    )
    const shown = recentDecks(many)
    expect(shown).toHaveLength(recentCount)
    expect(shown[0]?.deck).toBe(`d${recentCount + 2}`)
    expect(shown.at(-1)?.deck).toBe("d3")
  })

  it("shows every deck when there are no more than recentCount", () => {
    expect(recentDecks([atlas, budget, board])).toEqual([budget, atlas, board])
  })
})

describe("deckPath", () => {
  it("opens every deck in the Doom editor at /s", () => {
    expect(deckPath({ deck: "new" })).toBe("/s/new")
  })
})
