import { expect, it } from "vitest"

import * as budget from "./budget.js"

it("holds every cap on what one call answers in one place", () => {
  expect({ ...budget }).toEqual({
    deckPage: 50,
    foundLines: 400,
    imagesPerCall: 10,
    namedIds: 5,
    readBytes: 24_000,
    resultChars: 20_000,
    scriptLimits: { ms: 20_000, memory: 64 * 1024 * 1024, stack: 1024 * 1024, logs: 50 },
    shotsPerCall: 4,
    shownFindings: 10,
  })
})
