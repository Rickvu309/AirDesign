import { describe, expect, it } from "vitest"
import { saveShown } from "./use-save-shown"

describe("what the editor shows for a deck's status", () => {
  it("shows no notice while edits are saved or saving", () => {
    expect(saveShown({ status: { kind: "saved" }, online: true })).toEqual({ notice: null, save: "saved" })
    expect(saveShown({ status: { kind: "saving" }, online: false })).toEqual({ notice: null, save: "saving" })
  })

  it("says offline when the device has no network, and unreached when the network is up but AirDesign is not", () => {
    expect(saveShown({ status: { kind: "offline" }, online: false })).toEqual({ notice: "offline", save: "offline" })
    expect(saveShown({ status: { kind: "offline" }, online: true })).toEqual({
      notice: "unreached",
      save: "unreached",
    })
    expect(saveShown({ status: { kind: "blocked" }, online: true })).toEqual({
      notice: "unreached",
      save: "unreached",
    })
  })

  it("says edits are at risk while the device cannot keep them", () => {
    expect(saveShown({ status: { kind: "storage-failed" }, online: true })).toEqual({
      notice: "storage-failed",
      save: "saving",
    })
  })

  it("shows a refused undo while keeping the saved status", () => {
    expect(
      saveShown({ status: { kind: "turn-refused", turn: "undo", save: { kind: "saved" } }, online: true }),
    ).toEqual({ notice: "undo-refused", save: "saved" })
  })

  it("names a skipped component update while keeping the saved status", () => {
    expect(
      saveShown({ status: { kind: "turn-skipped", turn: "undo", save: { kind: "saved" } }, online: true }),
    ).toEqual({ notice: "undo-skipped", save: "saved" })
    expect(
      saveShown({ status: { kind: "turn-skipped", turn: "redo", save: { kind: "saving" } }, online: true }),
    ).toEqual({ notice: "redo-skipped", save: "saving" })
  })

  it("says one edit, several edits or a too large edit was set aside", () => {
    const aside = (edits: number, tooLarge: boolean) =>
      saveShown({ status: { kind: "set-aside", edits, tooLarge }, online: true })
    expect(aside(1, false)).toEqual({ notice: "set-aside-one", save: "unsaved" })
    expect(aside(3, false)).toEqual({ notice: "set-aside", save: "unsaved" })
    expect(aside(2, true)).toEqual({ notice: "set-aside-too-large", save: "unsaved" })
  })
})
