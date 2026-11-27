import { describe, expect, it } from "vitest"
import { noticeShown, saveShown } from "./use-save-shown"

describe("what the editor shows for a deck's status", () => {
  it("shows no notice while edits are saved or saving", () => {
    expect(saveShown({ status: { kind: "saved" }, online: true })).toEqual({ notice: null, save: "saved" })
    expect(saveShown({ status: { kind: "saving" }, online: false })).toEqual({ notice: null, save: "saving" })
  })

  it("names offline and unreached in the save status alone, with no notice over the canvas", () => {
    expect(saveShown({ status: { kind: "offline" }, online: false })).toEqual({ notice: null, save: "offline" })
    expect(saveShown({ status: { kind: "offline" }, online: true })).toEqual({
      notice: null,
      save: "unreached",
    })
    expect(saveShown({ status: { kind: "blocked" }, online: true })).toEqual({
      notice: null,
      save: "unreached",
    })
  })

  it("says edits are at risk while the device cannot keep them", () => {
    expect(saveShown({ status: { kind: "storage-failed" }, online: true })).toEqual({
      notice: "storage-failed",
      save: "saving",
    })
  })

  it("says one edit, several edits or a too large edit was set aside", () => {
    const aside = (edits: number, tooLarge: boolean) =>
      saveShown({ status: { kind: "set-aside", edits, tooLarge }, online: true })
    expect(aside(1, false)).toEqual({ notice: "set-aside-one", save: "unsaved" })
    expect(aside(3, false)).toEqual({ notice: "set-aside", save: "unsaved" })
    expect(aside(2, true)).toEqual({ notice: "set-aside-too-large", save: "unsaved" })
  })
})

describe("which notice the editor shows when an export fails too", () => {
  it("shows the export failure over an ordinary save notice", () => {
    expect(noticeShown("set-aside", "paint")).toBe("export-failed")
    expect(noticeShown(null, "fonts")).toBe("export-fonts")
    expect(noticeShown(null, "capacity")).toBe("export-capacity")
  })

  it("keeps the warning that edits are at risk in view when an export fails", () => {
    expect(noticeShown("storage-failed", "paint")).toBe("storage-failed")
  })

  it("shows the save notice when no export failed", () => {
    expect(noticeShown("set-aside", false)).toBe("set-aside")
    expect(noticeShown(null, false)).toBeNull()
  })
})
