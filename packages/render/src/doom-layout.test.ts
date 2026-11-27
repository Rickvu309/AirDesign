import * as doom from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"
import { testTheme } from "@airdesign/doom/testing"

const read = vi.hoisted(() => ({ texts: 0 }))

vi.mock("@airdesign/fonts", async () => {
  const actual = await vi.importActual<typeof import("@airdesign/fonts")>("@airdesign/fonts")
  return {
    ...actual,
    hanLanguage: (texts: Iterable<string>) => {
      const all = [...texts]
      read.texts += all.length
      return actual.hanLanguage(all)
    },
  }
})

const { deckLocale } = await import("./doom-layout.js")

const spot = (x: number) => ({ x, y: 100, w: 600, h: 100, rotation: 0, flipH: false, flipV: false })

function deckOf(slides: number) {
  return doom.doomFromTree({
    theme: testTheme,
    slides: Array.from({ length: slides }, (_, slide) => ({
      children: Array.from({ length: 6 }, (_, shape) => ({
        type: "shape" as const,
        name: `${String(slide)}.${String(shape)}`,
        props: {
          box: spot(100),
          text: doom.textFromMarkdown(shape === 0 && slide === 0 ? "東京本社" : "Revenue", "body"),
        },
      })),
    })),
  })
}

function landed(fold: doom.Doom, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(fold, {
    once: `edit-${String(fold.rev)}`,
    author: { kind: "person", id: "tab" },
    writes: writes.map((write) => {
      const base = fold.revs.get(write.node)?.get(write.prop)
      return base === undefined ? write : { ...write, base }
    }),
    rev: doom.rev(fold.rev + 1),
  })
  if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
  return next
}

describe("the deck's language after an edit", () => {
  it("reads no text when the edit changed none", () => {
    const grown = deckOf(40)
    expect(deckLocale(grown.doom)).toBe("und")
    const before = read.texts
    const moved = landed(grown.doom, [{ node: grown.ids["3.2"]!, prop: "box", value: spot(140) }])
    expect(deckLocale(moved)).toBe("und")
    expect(read.texts - before).toBe(0)
  })

  it("reads the deck again when an edit changed a text", () => {
    const grown = deckOf(2)
    expect(deckLocale(grown.doom)).toBe("und")
    const typed = landed(grown.doom, [
      { node: grown.ids["1.1"]!, prop: "text", value: doom.textFromMarkdown("まとめ", "body") },
    ])
    expect(deckLocale(typed)).toBe("ja")
  })

  it("reads the deck again when an edit moved a text off the deck", () => {
    const grown = deckOf(1)
    const japanese = landed(grown.doom, [
      { node: grown.ids["0.1"]!, prop: "text", value: doom.textFromMarkdown("まとめ", "body") },
    ])
    expect(deckLocale(japanese)).toBe("ja")
    expect(deckLocale(landed(japanese, [{ node: grown.ids["0.1"]!, prop: "parent", value: null }]))).toBe("und")
  })
})
