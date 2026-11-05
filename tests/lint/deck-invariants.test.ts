import { expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { deckInvariantHits } from "../../scripts/lint/deck-invariants.ts"
it("rejects bare reference ids and optional first run and accepts the canonical model", () => {
  const file = "packages/deck/src/model.ts"
  expect(deckInvariantHits(file, "type Base = { theme: string | null; placeholder: string | null; overlap: string | null }\ntype Text = { runs: Run[] }\ntype Deck = { themes: { id: string }[] }")).toHaveLength(3)
  expect(deckInvariantHits(file, readFileSync(file, "utf8"))).toEqual([])
})
