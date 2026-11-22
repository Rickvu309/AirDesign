import { readDeckId } from "@airdesign/catalog"
import { elementId, format, landedPatch, templateColors, templateStyleNode, type Palette } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const overrideRed = "FF0000"

const lightPalette: Palette = {
  slots: {
    dk1: "16191D",
    lt1: "FFFFFF",
    dk2: "1B2A4A",
    lt2: "F2F4F7",
    accent1: "2F5BD3",
    accent2: "0E9384",
    accent3: "E08A1E",
    accent4: "7A5AF8",
    accent5: "D92D20",
    accent6: "4E8B2F",
    hlink: "2F5BD3",
    folHlink: "7A5AF8",
  },
  map: { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" },
  fonts: { major: "Inter SemiBold", minor: "Inter" },
}

const darkPalette: Palette = {
  slots: {
    dk1: "0E1626",
    lt1: "F4F6FA",
    dk2: "1A2438",
    lt2: "9AA6BA",
    accent1: "6B9BFF",
    accent2: "34C3A6",
    accent3: "F5B54A",
    accent4: "A98BFA",
    accent5: "F06A73",
    accent6: "8AD167",
    hlink: "7AA6FF",
    folHlink: "C3A9FF",
  },
  map: { bg1: "dk1", tx1: "lt1", bg2: "dk2", tx2: "lt2" },
  fonts: { major: "Inter SemiBold", minor: "Inter" },
}

function landed(
  result: { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly refusal: string },
): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function indexed(palettes: readonly Palette[]): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const templateStyles = palettes.map((palette, at) => ({
    id: `ppt/theme/theme${String(at + 1)}.xml`,
    name: `Theme ${String(at + 1)}`,
    palette,
  }))
  const title = { node: elementId("256.2"), kind: "shape", value: "Title", box: null, grouped: false } as const
  return landed(
    indexDeck(openDeck(id.deck), person, {
      deck: "deck",
      format,
      once: "index",
      offset: 0,
      total: 1,
      templateStyles,
      slides: [{ id: "256", position: 0, templateStyle: templateStyles[0]!.id }],
      elements: [title],
    }),
  )
}

describe("applying a template through templateStyle.template", () => {
  it("expands Midnight's twelve colours by role against a light colour map and sets both fonts in one change, and undo_run restores all of them", () => {
    let deck = indexed([lightPalette])
    deck = landed(
      call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.templateStyle1" }] }),
    )
    const before = deck.revision
    deck = landed(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "midnight" } }],
      }),
    )
    expect(deck.revision).toBe(before + 1)
    const body = deck.register.elements[templateStyleNode(0)]
    expect(body?.landed).toHaveLength(1)
    const patch = body === undefined ? undefined : landedPatch(body, "text").templateStyle
    expect(patch).toEqual({
      dk1: { set: "F4F6FA" },
      lt1: { set: "0E1626" },
      dk2: { set: "9AA6BA" },
      lt2: { set: "1A2438" },
      accent1: { set: "6B9BFF" },
      accent2: { set: "34C3A6" },
      accent3: { set: "F5B54A" },
      accent4: { set: "A98BFA" },
      accent5: { set: "F06A73" },
      accent6: { set: "8AD167" },
      hlink: { set: "7AA6FF" },
      folHlink: { set: "C3A9FF" },
      major: { set: "Inter SemiBold" },
      minor: { set: "Inter" },
    })
    const read = readDeckPage(deck, { runId: "run" })
    expect(read.templateStyles?.[0]?.palette).toEqual({
      slots: {
        dk1: "F4F6FA",
        lt1: "0E1626",
        dk2: "9AA6BA",
        lt2: "1A2438",
        accent1: "6B9BFF",
        accent2: "34C3A6",
        accent3: "F5B54A",
        accent4: "A98BFA",
        accent5: "F06A73",
        accent6: "8AD167",
        hlink: "7AA6FF",
        folHlink: "C3A9FF",
      },
      map: lightPalette.map,
      fonts: { major: "Inter SemiBold", minor: "Inter" },
    })
    expect(JSON.stringify(read)).not.toContain('"template":')
    deck = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(readDeckPage(deck, { runId: null }).templateStyles?.[0]?.palette).toEqual(lightPalette)
  })

  it("expands a light template onto a dark colour map, and sets Editorial's serif heading font", () => {
    let deck = indexed([darkPalette])
    deck = landed(
      call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "deck.templateStyle1" }] }),
    )
    deck = landed(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "editorial" } }],
      }),
    )
    const palette = readDeckPage(deck, { runId: "run" }).templateStyles?.[0]?.palette
    expect(palette).toEqual({
      slots: {
        dk1: "FBF8F3",
        lt1: "231F1C",
        dk2: "EFE8DD",
        lt2: "3A2E26",
        accent1: "B4532A",
        accent2: "5F7A4A",
        accent3: "C8962E",
        accent4: "7B4B6E",
        accent5: "2F6F8F",
        accent6: "8C6239",
        hlink: "B4532A",
        folHlink: "7B4B6E",
      },
      map: darkPalette.map,
      fonts: { major: "Source Serif 4 SemiBold", minor: "Inter" },
    })
  })

  it("expands each template style against its own colour map on a multi-theme deck and honours explicit overrides", () => {
    let deck = indexed([lightPalette, darkPalette])
    deck = landed(
      call("start_run", deck, agent, {
        deck: "deck",
        runId: "run",
        elements: [{ node: "deck.templateStyle1" }, { node: "deck.templateStyle2" }],
      }),
    )
    deck = landed(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [
          {
            op: "set",
            target: "deck.templateStyles",
            templateStyle: { template: "midnight", accent1: `#${overrideRed}` },
          },
        ],
      }),
    )
    const styles = readDeckPage(deck, { runId: "run" }).templateStyles ?? []
    expect(styles[0]?.palette.slots).toMatchObject({ lt1: "0E1626", dk1: "F4F6FA", accent1: overrideRed })
    expect(styles[1]?.palette.slots).toMatchObject({ dk1: "0E1626", lt1: "F4F6FA", accent1: overrideRed })
    for (const style of styles) {
      for (const slot of templateColors) expect(style.palette.slots[slot]).toMatch(/^[0-9A-F]{6}$/)
    }
  })

  it("refuses templateStyle.template on a shape or a slide", () => {
    let deck = indexed([lightPalette])
    deck = landed(
      call("start_run", deck, agent, {
        deck: "deck",
        runId: "run",
        elements: [{ node: "256.2" }, { node: "256.slide" }],
      }),
    )
    expect(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [{ op: "set", target: "256.2", templateStyle: { template: "midnight" } }],
      }),
    ).toMatchObject({ ok: false, refusal: "kind" })
    expect(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [{ op: "set", target: "256", templateStyle: { template: "midnight" } }],
      }),
    ).toMatchObject({ ok: false, refusal: "kind" })
  })
})
