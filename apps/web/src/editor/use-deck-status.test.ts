import { toast } from "sonner"
import { expect, it, vi } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { saveStatus, shownNotice, tellRefusal } from "@/editor/use-deck-status"

const quiet = {
  failure: null,
  told: null,
  picture: null,
  online: true,
  offline: false,
  pending: false,
  aside: 0,
  asideTooLarge: false,
  refusal: null,
} as const

it("shows nothing when the deck is saved", () => {
  expect(shownNotice(quiet)).toBe(null)
})

it("says offline only while an edit waits to send with the browser offline", () => {
  const away = { ...quiet, online: false }
  expect(shownNotice({ ...away, offline: true })).toBe(null)
  expect(shownNotice({ ...away, pending: true })).toBe(null)
  expect(shownNotice({ ...away, offline: true, pending: true })).toBe("offline")
})

it("says AirDesign cannot be reached while an edit waits to send with the browser online", () => {
  expect(shownNotice({ ...quiet, offline: true })).toBe(null)
  expect(shownNotice({ ...quiet, offline: true, pending: true })).toBe("unreached")
})

it("says which way undo changed nothing", () => {
  expect(shownNotice({ ...quiet, told: "undo" })).toBe("undo-changed")
  expect(shownNotice({ ...quiet, told: "redo" })).toBe("redo-changed")
})

it("says when edits on this device were set aside", () => {
  expect(shownNotice({ ...quiet, aside: 1 })).toBe("set-aside")
})

it("says an edit set aside as too large was too large, not that the deck changed", () => {
  expect(shownNotice({ ...quiet, aside: 1, asideTooLarge: true })).toBe("set-aside-too-large")
  expect(shownNotice({ ...quiet, aside: 0, asideTooLarge: true })).toBe(null)
})

it("puts a failure before undo, undo before a picture, a picture before set-aside edits, and those before offline", () => {
  const all = {
    failure: "export-failed",
    told: "undo",
    picture: "picture-type",
    online: false,
    offline: true,
    pending: true,
    aside: 1,
    asideTooLarge: false,
    refusal: "storage",
  } as const
  expect(shownNotice(all)).toBe("export-failed")
  expect(shownNotice({ ...all, failure: null })).toBe("undo-changed")
  expect(shownNotice({ ...all, failure: null, told: null })).toBe("picture-type")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null })).toBe("set-aside")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null, aside: 0 })).toBe("offline")
  expect(shownNotice({ ...all, failure: null, told: null, picture: null, aside: 0, offline: false })).toBe(
    "storage-failed",
  )
})

it("says why the server refused an edit while it waits on this device", () => {
  expect(shownNotice({ ...quiet, pending: true, refusal: "storage" })).toBe("storage-failed")
  expect(shownNotice({ ...quiet, pending: true, refusal: "size" })).toBe("too-large")
  expect(shownNotice({ ...quiet, refusal: "size" })).toBe(null)
})

const landed = { online: true, offline: false, pending: false, refusal: null } as const

it("says saved once every edit has landed", () => {
  expect(saveStatus(landed)).toBe("saved")
  expect(saveStatus({ ...landed, offline: true })).toBe("saved")
})

it("says saving while an edit waits for the server and the server can be reached", () => {
  expect(saveStatus({ ...landed, pending: true })).toBe("saving")
})

it("says offline as soon as the browser goes offline, before any edit", () => {
  expect(saveStatus({ ...landed, online: false })).toBe("offline")
  expect(saveStatus({ ...landed, online: false, offline: true, pending: true })).toBe("offline")
})

it("says AirDesign cannot be reached while an edit waits with the browser online", () => {
  expect(saveStatus({ ...landed, offline: true, pending: true })).toBe("unreached")
})

it("says unable to save, not saving, while the server refused an edit that waits on this device", () => {
  expect(saveStatus({ ...landed, pending: true, refusal: "storage" })).toBe("unsaved")
  expect(saveStatus({ ...landed, pending: true, refusal: "size" })).toBe("unsaved")
  expect(saveStatus({ ...landed, refusal: "size" })).toBe("saved")
  expect(saveStatus({ ...landed, pending: true, offline: true, refusal: "size" })).toBe("unreached")
})

it("tells the person an edit too large to send was not saved, and stays quiet for other outcomes", () => {
  const told = vi.spyOn(toast, "error").mockImplementation(() => "")
  for (const outcome of ["refused", "sent", "size", "set-aside"] as const) tellRefusal(outcome)
  expect(told).not.toHaveBeenCalled()
  tellRefusal("too-large")
  expect(told).toHaveBeenCalledExactlyOnceWith(productCopy.editTooLarge)
  told.mockRestore()
})
