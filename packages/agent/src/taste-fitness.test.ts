import * as doom from "@airdesign/doom"
import { guides, pieces, problemRules, styles } from "@airdesign/taste"
import { testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { worded } from "./problem-words.js"
import { memoryDecks } from "./testing/memory-decks.js"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

async function drawn(style: string, draw: (slide: string) => string) {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (script: string, deck?: string) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(
      "airdesign_execute",
      { script, ...(deck === undefined ? {} : { deck }) },
      session,
      host,
    )
    expect(result.ok, JSON.stringify(result.fields)).toBe(true)
    return result.fields as { deck: string; slides: string[] }
  }
  const { deck } = await call(`createDeck({ style: "${style}" })`)
  const { result } = (await call(`insert({ kind: "slide" })`, deck)) as unknown as { result: string }
  await call(draw(result), deck)
  const fold = decks.decks.get(deck as never)!
  const slides = doom.slidesOf(fold).map((slide) => slide.id)
  return worded(fold, doom.layoutProblems(fold, slides, estimate, problemRules)).map((problem) => problem.note)
}

const scriptOf = (markdown: string) => [...markdown.matchAll(/```js\n([\s\S]*?)```/g)].map((found) => found[1]!)

const recipes = guides().filter((guide) => /^(charts|diagrams)\//.test(guide.name))

describe("every kit piece and recipe draws clean in every style", () => {
  it("finds pieces and recipes to judge", () => {
    expect(pieces().length).toBeGreaterThan(0)
    expect(recipes.length).toBeGreaterThan(0)
    for (const recipe of recipes) expect(scriptOf(recipe.markdown).length, recipe.name).toBeGreaterThan(0)
  })

  for (const { id } of styles) {
    for (const { name } of pieces())
      it(`kit/${name} in ${id}`, async () => {
        const problems = await drawn(
          id,
          (slide) => `copy({ from: "kit/${name}", parent: "${slide}", box: { x: 120, y: 120 } })`,
        )
        expect(problems).toEqual([])
      })

    for (const recipe of recipes)
      it(`${recipe.name} in ${id}`, async () => {
        const script = scriptOf(recipe.markdown).join("\n")
        const problems = await drawn(id, (slide) => script.replace('"<slide id>"', JSON.stringify(slide)))
        expect(problems).toEqual([])
      })
  }
})
