import { gestures, type GestureId } from "@airdesign/render"
import { describe, expect, it } from "vitest"
import { shortcutCopy } from "@/copy/shortcut-copy"
import { keyPlatform, shortcutCaps, type KeyPlatform } from "@/editor/shortcut-text"

function caps(id: GestureId, platform: KeyPlatform) {
  const row = gestures.find((each) => each.id === id)
  if (row === undefined) throw new Error(id)
  return shortcutCaps(row, platform)
}

const { mac, other } = shortcutCopy.chord

describe("the keys the shortcuts panel shows", () => {
  it("shows Command, Option and Shift signs on a Mac, and Ctrl, Alt and Shift elsewhere", () => {
    expect(caps("ungroup", "mac")).toEqual([
      [mac.shift, mac.mod, "G"],
      [mac.mod, shortcutCopy.macKeyNames.Backspace],
    ])
    expect(caps("ungroup", "other")).toEqual([
      [other.mod, other.shift, "G"],
      [other.mod, "Backspace"],
    ])
    expect(caps("frame", "mac")).toEqual([[mac.alt, mac.mod, "G"]])
    expect(caps("frame", "other")).toEqual([[other.mod, other.alt, "G"]])
  })

  it("keeps Control as Control on a Mac where the row asks for it", () => {
    expect(caps("redo", "mac").at(-1)).toEqual([mac.ctrl, "Y"])
    expect(caps("redo", "other").at(-1)).toEqual([other.ctrl, "Y"])
  })

  it("shows a Command-only key on a Mac and leaves it out elsewhere", () => {
    expect(caps("front", "mac")).toEqual([["]"], [mac.shift, mac.mod, "]"], [mac.alt, mac.mod, "]"]])
    expect(caps("front", "other")).toEqual([["]"], [other.mod, other.shift, "]"]])
  })

  it("names arrows, digits and named keys in a person's words", () => {
    expect(caps("nudge", "other")).toEqual([[shortcutCopy.arrows]])
    expect(caps("nudge-far", "mac")).toEqual([[mac.shift, shortcutCopy.arrows]])
    expect(caps("show-number", "other")).toEqual([[shortcutCopy.digits]])
    expect(caps("show-previous", "other")).toEqual([["←"], ["↑"], [shortcutCopy.keyNames.PageUp]])
    expect(caps("delete", "mac")).toEqual([[shortcutCopy.macKeyNames.Backspace]])
    expect(caps("zoom-fit", "other")).toEqual([[other.shift, "1"]])
  })

  it("says what a pointer does for a pointer gesture", () => {
    const words = shortcutCopy.pointing
    expect(caps("select", "mac")).toEqual([[words.click]])
    expect(caps("select-add", "mac")).toEqual([[mac.shift, words.click]])
    expect(caps("resize", "other")).toEqual([[`${words.drag} ${words.corner}`], [`${words.drag} ${words.edge}`]])
    expect(caps("step-in", "other")).toEqual([[words.double]])
  })

  it("gives every row something to show on both platforms", () => {
    const empty = gestures.flatMap((row) =>
      (["mac", "other"] as const)
        .filter((platform) => shortcutCaps(row, platform).length === 0)
        .map((platform) => `${row.id} on ${platform}`),
    )
    expect(empty).toEqual([])
  })

  it("reads a Mac from the browser's agent", () => {
    expect(keyPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")).toBe("mac")
    expect(keyPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other")
    expect(keyPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other")
  })
})
