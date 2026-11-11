import { expect, it } from "vitest"
import { deckTime } from "./deck-time"

const now = Date.parse("2026-11-11T12:00:00Z")

it.each([
  [0, "Just now", "Edited just now"],
  [2 / 24, "2 hours ago", "Edited 2 hours ago"],
  [1, "Yesterday", "Edited yesterday"],
  [7, "Last week", "Edited last week"],
  [21, "3 weeks ago", "Edited 3 weeks ago"],
  [31, "Last month", "Edited last month"],
])("uses the designed time words for %s days", (days, row, card) => {
  expect(deckTime(new Date(now - days * 86400000).toISOString(), now)).toMatchObject({ row, card })
})

it("formats created dates and counts whole days in Trash", () => {
  expect(deckTime("2026-10-30T12:00:00Z", now).created).toBe("Oct 30")
  expect(deckTime("2026-11-09T11:00:00Z", now).trash).toBe("Deleted 2 days ago, 28 days left")
})
