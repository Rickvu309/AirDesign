import * as doom from "@airdesign/doom"
import { newDeckTheme, styles } from "@airdesign/taste"
import { expect, it } from "vitest"

import { callTool } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

function agent() {
  const host = memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ children: [] }] }).doom)
  let calls = 0
  const session = { agent: "aira", mint: () => `style-${String(++calls)}` }
  return {
    decks: host.decks,
    execute: (script: string, deck?: unknown) =>
      callTool("airdesign_execute", { script, ...(deck === undefined ? {} : { deck }) }, session, host),
  }
}

it("creates with a built-in style and saves nothing when the script fails", async () => {
  const by = agent()
  const create = 'createDeck({ name: "Regional revenue", style: "consulting" })'
  const interrupted = await by.execute(`${create}; throw new Error("stop")`)
  expect(interrupted.fields).toMatchObject({ ok: false, refusal: "script" })
  expect(by.decks.size).toBe(0)
  const made = await by.execute(create)
  expect(made.fields).toMatchObject({ ok: true, name: "Regional revenue", style: "consulting" })
})

it.each(styles)("writes and reads the full $name theme through createDeck and variables", async (style) => {
  const by = agent()
  const initial = await by.execute(`createDeck({ style: "${style.id}" })`)
  expect(initial.fields).toMatchObject({ ok: true, style: style.id })
  const [made] = [...by.decks.values()]
  expect(doom.deckOf(made!).theme).toEqual(style.theme)
  const expected = {
    style: style.id,
    theme: {
      colors: style.theme.colors,
      fonts: style.theme.fonts,
      sizes: { title: style.theme.textStyles.title.size },
    },
  }
  const created = await by.execute("get()", initial.fields.deck)
  expect(created.fields.result).toMatchObject(expected)

  const blank = await by.execute("createDeck()")
  const changed = await by.execute(`variables({ style: "${style.id}" }); get().style`, blank.fields.deck)
  expect(changed.fields).toMatchObject({ ok: true, result: style.id })
  const [, saved] = [...by.decks.values()]
  expect(doom.deckOf(saved!).theme).toEqual(style.theme)
  expect((await by.execute("get()", blank.fields.deck)).fields.result).toMatchObject(expected)
})

it.each(['"constructor"', "{}"])("refuses %s as a style in variables", async (requested) => {
  const by = agent()
  const { deck, rev } = (await by.execute("createDeck()")).fields
  const changed = await by.execute(`variables({ style: ${requested} })`, deck)
  expect(changed.fields).toMatchObject({ ok: false, refusal: "field", field: "style" })
  expect((await by.execute("get()", deck)).fields).toMatchObject({ rev })
})

it("refuses an unknown style name in createDeck without saving a deck", async () => {
  const by = agent()
  const made = await by.execute('createDeck({ style: "constructor" })')
  expect(made.fields).toMatchObject({ ok: false, refusal: "field", field: "style" })
  expect(by.decks.size).toBe(0)
})

it("reports custom theme values with no named style", async () => {
  const by = agent()
  const { deck } = (await by.execute("createDeck()")).fields
  const { accent1 } = newDeckTheme.colors
  const changed = await by.execute(
    `variables({ style: "consulting", colors: { accent1: ${JSON.stringify(accent1)} } }); get().style`,
    deck,
  )
  expect(changed.fields).toMatchObject({ ok: true, result: null })
  expect((await by.execute("get()", deck)).fields.result).toMatchObject({
    style: null,
    theme: { colors: { accent1 } },
  })
})

const variants = styles.flatMap((style) => style.variants.map((variant) => ({ style, variant })))

it.each(variants)("applies the $variant.name variant of $style.name through variables", async ({ style, variant }) => {
  const by = agent()
  const { deck } = (await by.execute("createDeck()")).fields
  const changed = await by.execute(
    `variables({ style: "${style.id}", variant: "${variant.name}" }); const read = get(); [read.style, read.variant]`,
    deck,
  )
  expect(changed.fields).toMatchObject({ ok: true, result: [style.id, variant.name] })
  const [saved] = [...by.decks.values()]
  expect(doom.deckOf(saved!).theme).toEqual(variant.theme)
})

it("refuses an unknown variant with the style's variants", async () => {
  const by = agent()
  const { deck, rev } = (await by.execute("createDeck()")).fields
  const changed = await by.execute('variables({ style: "neutral", variant: "loud" })', deck)
  expect(changed.fields).toMatchObject({ ok: false, refusal: "field", field: "variant", form: "One of calm, dense." })
  expect((await by.execute("get()", deck)).fields).toMatchObject({ rev })
})

it("refuses a variant sent without its style", async () => {
  const by = agent()
  const { deck, rev } = (await by.execute("createDeck()")).fields
  const changed = await by.execute('variables({ variant: "calm" })', deck)
  expect(changed.fields).toMatchObject({ ok: false, refusal: "field", field: "style", fault: "missing" })
  expect((await by.execute("get()", deck)).fields).toMatchObject({ rev })
})
