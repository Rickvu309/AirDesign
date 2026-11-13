import { expect, it } from "vitest"
import { shownNotice } from "@/editor/use-deck-status"

const quiet = { failure: null, told: null, picture: null, offline: false, pending: false, aside: 0 } as const

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

it("says when edits on this device were set aside", () => {
  expect(shownNotice({ ...quiet, aside: 1 })).toBe("set-aside")
})

it("puts a failure before undo, undo before a picture, a picture before set-aside edits, and those before offline", () => {
  const all = {
    failure: "export-failed",
    told: "undo",
    picture: "picture-type",
    offline: true,
    pending: true,
    aside: 1,
  } as const
  expect(shownNotice(all)).toBe("export-failed")
  expect(shownNotice({ ...all, failure: null })).toBe("undo-changed")
  expect(shownNotice({ ...all, failure: null, told: null })).toBe("picture-type")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null })).toBe("set-aside")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null, aside: 0 })).toBe("offline")
})
