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
  [365, "Deleted last month, 0 days left"],
])("writes the Trash words for %s days", (days, trash) => {
  expect(deckTime(ago(days), now).trash).toBe(trash)
})

it("formats created dates", () => {
  expect(deckTime("2026-10-30T12:00:00Z", now).created).toBe("Oct 30")
})

it.each([
  ["2026-10-12T12:00:00Z", "Oct 12, 2026"],
  ["2026-10-11T12:00:00Z", "Oct 11, 2026"],
  ["2026-08-11T12:00:00Z", "Aug 11, 2026"],
  ["2025-11-11T12:00:00Z", "Nov 11, 2025"],
  ["2024-11-11T12:00:00Z", "Nov 11, 2024"],
])("shows an absolute date for the older edit %s", (iso, date) => {
  expect(deckTime(iso, now)).toMatchObject({ row: date, card: `Edited on ${date}` })
})

it.each([
  ["2025-12-01T23:30:00-02:00", "Dec 2, 2025", "Edited on Dec 2, 2025"],
  ["2025-12-31T23:30:00-02:00", "Jan 1", "Edited yesterday"],
  ["2025-12-31T23:30:00Z", "Dec 31, 2025", "Edited yesterday"],
])("keeps the year and UTC day across New Year for %s", (iso, created, card) => {
  expect(deckTime(iso, Date.parse("2026-01-02T12:00:00Z"))).toMatchObject({ created, card })
})

it("keeps future timestamps at just now", () => {
  expect(deckTime("2027-01-01T12:00:00Z", now)).toEqual({
    row: "Just now",
    card: "Edited just now",
    created: "Jan 1, 2027",
    trash: "Deleted just now, 30 days left",
  })
})

it("rejects an invalid timestamp", () => {
  expect(() => deckTime("invalid", now)).toThrow(RangeError)
})

it.each([
  ["2025-11-11T12:00:00Z", "Nov 11, 2025"],
  ["2024-11-11T12:00:00Z", "Nov 11, 2024"],
])("distinguishes created dates in other years for %s", (iso, created) => {
  expect(deckTime(iso, now).created).toBe(created)
})
