import { expect, it } from "vitest"
import { deckTime } from "./deck-time"

const now = Date.parse("2026-11-11T12:00:00Z")
const ago = (days: number) => new Date(now - days * 86400000).toISOString()

it.each([
  [0, "Just now", "Edited just now"],
  [1 / 24, "1 hour ago", "Edited 1 hour ago"],
  [2 / 24, "2 hours ago", "Edited 2 hours ago"],
  [1, "Yesterday", "Edited yesterday"],
  [2, "2 days ago", "Edited 2 days ago"],
  [7, "Last week", "Edited last week"],
  [14, "2 weeks ago", "Edited 2 weeks ago"],
  [21, "3 weeks ago", "Edited 3 weeks ago"],
  [30, "Last month", "Edited last month"],
  [31, "Last month", "Edited last month"],
])("uses the designed time words for %s days", (days, row, card) => {
  expect(deckTime(ago(days), now)).toMatchObject({ row, card })
})

it.each([
  [0, "Deleted just now, 30 days left"],
  [1, "Deleted yesterday, 29 days left"],
  [2, "Deleted 2 days ago, 28 days left"],
  [7, "Deleted last week, 23 days left"],
  [21, "Deleted 3 weeks ago, 9 days left"],
  [29, "Deleted 4 weeks ago, 1 day left"],
  [30, "Deleted last month, 0 days left"],
])("writes the Trash words for %s days", (days, trash) => {
  expect(deckTime(ago(days), now).trash).toBe(trash)
})

it("formats created dates", () => {
  expect(deckTime("2026-10-30T12:00:00Z", now).created).toBe("Oct 30")
})
