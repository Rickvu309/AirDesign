import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { arrivalOf, showsOf } from "./slide-arrival"

function landed(view: doom.Doom, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(view, {
    once: `test-${String(view.rev + 1)}`,
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  })
  if (doom.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
  return next
}

describe("how a slide arrives in Present", () => {
  it("maps the slide transition onto the playback styles", () => {
    expect(arrivalOf(undefined)).toBeNull()
    expect(arrivalOf({ kind: "none", ms: 400 })).toBeNull()
    expect(arrivalOf({ kind: "fade", ms: 0 })).toBeNull()
    expect(arrivalOf({ kind: "fade", ms: 400 })).toEqual({ kind: "fade", direction: null, duration: 400 })
    expect(arrivalOf({ kind: "push", ms: 300 })).toEqual({ kind: "push", direction: "l", duration: 300 })
    expect(arrivalOf({ kind: "smartMove", ms: 500 })).toEqual({ kind: "morph", direction: null, duration: 500 })
  })

  it("hides a skipped slide and plays the next slide's transition", () => {
    const grown = doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: [{ children: [] }, { children: [] }],
    })
    const slides = grown.slides
    const after = landed(grown.doom, [
      { node: slides[0]!, prop: "skipped", value: true },
      { node: slides[1]!, prop: "transition", value: { kind: "push", ms: 250 } },
    ])
    expect(showsOf(after, slides)).toEqual([
      { hidden: true, transition: null, advance: null },
      { hidden: false, transition: { kind: "push", direction: "l", duration: 250 }, advance: null },
    ])
  })
})
