import { expect, it } from "vitest"
import { shownNotice } from "@/editor/use-deck-status"

const quiet = { failure: null, told: null, picture: null, offline: false, pending: false } as const

it("shows nothing when the deck is saved", () => {
  expect(shownNotice(quiet)).toBe(null)
})

it("says offline only while an edit waits to send", () => {
  expect(shownNotice({ ...quiet, offline: true })).toBe(null)
  expect(shownNotice({ ...quiet, pending: true })).toBe(null)
  expect(shownNotice({ ...quiet, offline: true, pending: true })).toBe("offline")
})

it("says which way undo changed nothing", () => {
  expect(shownNotice({ ...quiet, told: "undo" })).toBe("undo-changed")
  expect(shownNotice({ ...quiet, told: "redo" })).toBe("redo-changed")
})

it("puts a failure before undo, undo before a picture, and a picture before offline", () => {
  const all = { failure: "export-failed", told: "undo", picture: "picture-type", offline: true, pending: true } as const
  expect(shownNotice(all)).toBe("export-failed")
  expect(shownNotice({ ...all, failure: null })).toBe("undo-changed")
  expect(shownNotice({ ...all, failure: null, told: null })).toBe("picture-type")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null })).toBe("offline")
})
