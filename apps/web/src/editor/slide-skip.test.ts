import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { slideListCopy } from "@/copy/slide-list-copy"
import { landed } from "./testing/doom-fixtures"
import { skipSaid, skipWrites } from "./slide-skip"

function twoSlides() {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [{ children: [] }, { children: [] }],
  })
  return { view: grown.doom, slides: grown.slides }
}

function applied(view: doom.Doom, writes: readonly doom.Write[]) {
  const edit: doom.Landed = {
    once: "skip",
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  }
  const after = doom.applyEdit(view, edit)
  if (doom.isRefusal(after)) throw new Error("refused")
  return { after, edit }
}

describe("skip slide", () => {
  it("writes skipped on the chosen slides as one edit, and one undo restores each", () => {
    const { view, slides } = twoSlides()
    const writes = skipWrites(view, slides, [0, 1], true)
    expect(writes).toEqual([
      { node: slides[0], prop: "skipped", value: true },
      { node: slides[1], prop: "skipped", value: true },
    ])
    const { after, edit } = applied(view, writes)
    expect(doom.propOf(after.nodes.get(slides[0]!), "skipped")).toBe(true)
    expect(doom.propOf(after.nodes.get(slides[1]!), "skipped")).toBe(true)
    const undone = doom.applyEdit(after, {
      once: "undo",
      author: { kind: "person", id: "test" },
      writes: doom.invert(view, after, edit),
      rev: doom.rev(after.rev + 1),
    })
    if (doom.isRefusal(undone)) throw new Error("undo refused")
    expect(doom.propOf(undone.nodes.get(slides[0]!), "skipped")).not.toBe(true)
    expect(doom.propOf(undone.nodes.get(slides[1]!), "skipped")).not.toBe(true)
  })

  it("leaves a slide that already has the chosen skip out of the edit", () => {
    const { view, slides } = twoSlides()
    const skipped = landed(view, [{ node: slides[0]!, prop: "skipped", value: true }])
    expect(skipWrites(skipped, slides, [0, 1], true)).toEqual([{ node: slides[1], prop: "skipped", value: true }])
  })

  it("says what Present will do, for one slide and for a set", () => {
    expect(skipSaid(true, 1, 2)).toBe(slideListCopy.skippedInPresent(1, 2))
    expect(slideListCopy.skippedInPresent(1, 2)).toBe("Skipped slide 2 in Present")
    expect(slideListCopy.skippedInPresent(3, 1)).toBe("Skipped 3 slides in Present")
    expect(slideListCopy.shownInPresent(1, 2)).toBe("Slide 2 shows in Present")
    expect(slideListCopy.shownInPresent(3, 1)).toBe("3 slides show in Present")
  })
})
