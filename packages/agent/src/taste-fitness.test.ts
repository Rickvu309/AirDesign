import * as doom from "@airdesign/doom"
import { guides, pieces, problemRules, styles } from "@airdesign/taste"
import { testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { worded } from "./problem-words.js"
import { memoryDecks } from "./testing/memory-decks.js"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Look = { readonly label: string; readonly style: string; readonly variant?: string }

const looks: readonly Look[] = styles.flatMap((style) => [
  { label: style.id, style: style.id },
  ...style.variants.map(({ name }) => ({ label: `${style.id} ${name}`, style: style.id, variant: name })),
])

const sizedLooks: readonly Look[] = styles.flatMap((style) => [
  { label: style.id, style: style.id },
  ...style.variants
    .filter(({ theme }) => JSON.stringify(theme.textStyles) !== JSON.stringify(style.theme.textStyles))
    .map(({ name }) => ({ label: `${style.id} ${name}`, style: style.id, variant: name })),
])

const lookOf = (look: Look) =>
  `variables(${JSON.stringify(look.variant === undefined ? { style: look.style } : { style: look.style, variant: look.variant })})`

async function drawn(look: Look, draw: (slide: string) => string) {
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
  const { deck } = await call(`createDeck({ style: "${look.style}" })`)
  if (look.variant !== undefined) await call(lookOf(look), deck)
  const { result } = (await call(`insert({ kind: "slide" })`, deck)) as unknown as { result: string }
  await call(draw(result), deck)
  const problems = () => {
    const fold = decks.decks.get(deck as never)!
    const slides = doom.slidesOf(fold).map((slide) => slide.id)
    return worded(fold, doom.layoutProblems(fold, slides, estimate, problemRules)).map((problem) => problem.note)
  }
  const drawnFold = decks.decks.get(deck as never)!
  const restyled = async (target: Look) => {
    decks.decks.set(deck as never, drawnFold)
    await call(lookOf(target), deck)
    return problems()
  }
  return { problems: problems(), restyled }
}

const scriptOf = (markdown: string) => [...markdown.matchAll(/```js\n([\s\S]*?)```/g)].map((found) => found[1]!)

const recipes = guides().filter((guide) => /^(charts|diagrams)\//.test(guide.name))

const drawings = [
  ...pieces().map(({ name }) => ({
    name: `kit/${name}`,
    draw: (slide: string) => `copy({ from: "kit/${name}", parent: "${slide}", box: { x: 120, y: 120 } })`,
  })),
  ...recipes.map((recipe) => ({
    name: recipe.name,
    draw: (slide: string) => scriptOf(recipe.markdown).join("\n").replace('"<slide id>"', JSON.stringify(slide)),
  })),
]

describe("every kit piece and recipe draws clean in every style and variant", () => {
  it("finds pieces and recipes to judge", () => {
    expect(pieces().length).toBeGreaterThan(0)
    expect(recipes.length).toBeGreaterThan(0)
    for (const recipe of recipes) expect(scriptOf(recipe.markdown).length, recipe.name).toBeGreaterThan(0)
  })

  for (const look of looks)
    for (const { name, draw } of drawings)
      it(`${name} in ${look.label}`, async () => {
        expect((await drawn(look, draw)).problems).toEqual([])
      })
})

describe("every kit piece and recipe stays clean when the deck changes style", () => {
  it("switches between looks whose text sizes differ", () => {
    expect(sizedLooks.length).toBeGreaterThan(styles.length)
  })

  for (const from of sizedLooks)
    for (const { name, draw } of drawings)
      it(`${name} drawn in ${from.label}`, async () => {
        const { restyled } = await drawn(from, draw)
        const found: Record<string, readonly string[]> = {}
        for (const target of sizedLooks.filter((look) => look !== from)) {
          const problems = await restyled(target)
          if (problems.length > 0) found[target.label] = problems
        }
        expect(found).toEqual({})
      })
})
