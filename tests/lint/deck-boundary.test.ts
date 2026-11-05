import { expect, it } from "vitest"
import { importBoundaryHits } from "../../scripts/lint/import-boundary.ts"
it("rejects a runtime import in the canonical deck and accepts local types", () => {
  expect(importBoundaryHits("/repo/packages/deck/src/model.ts", 'import fs from "node:fs"', "/repo")).toMatchObject([{ reason: "deck-must-be-dependency-free" }])
  expect(importBoundaryHits("/repo/packages/deck/src/model.ts", 'import type { Deck } from "./model.ts"', "/repo")).toEqual([])
})
