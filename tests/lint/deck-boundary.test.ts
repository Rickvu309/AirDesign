import { expect, it } from "vitest"
import { importBoundaryHits } from "../../scripts/lint/import-boundary.ts"
it("rejects a runtime import in the canonical deck and accepts local types", () => {
  expect(importBoundaryHits("/repo/packages/deck/src/model.ts", 'import fs from "node:fs"', "/repo")).toMatchObject([{ reason: "deck-must-be-dependency-free" }])
  expect(importBoundaryHits("/repo/packages/deck/src/model.ts", 'import type { Deck } from "./model.ts"', "/repo")).toEqual([])
})
it("accepts nested deck modules while rejecting imports outside deck source", () => {
  const file = "/repo/packages/deck/src/text/body.ts"
  expect(importBoundaryHits(file, 'import type {Id} from "../model.ts"', "/repo")).toEqual([])
  expect(importBoundaryHits(file, 'import {parseTextBody} from "./body-codec.ts"', "/repo")).toEqual([])
  for (const specifier of ["../../../render/src/index.ts", "../../test/fixture.ts", "node:crypto", "zod", "react"]) {
    expect(importBoundaryHits(file, `import value from "${specifier}"`, "/repo")).toMatchObject([{reason: "deck-must-be-dependency-free"}])
  }
})
