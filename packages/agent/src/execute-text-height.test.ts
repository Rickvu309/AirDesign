import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom

it("keeps number badges and row texts at the height they centre their words in, on their rows", async () => {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: doom.measureWith({}), missing: new Map() }) }
  const session: Session = { agent: "aira", once: "call1", mint: () => "minted" }
  const made = await callTool("airdesign_execute", { script: "createDeck()" }, session, host)
  const { deck } = made.fields as { deck: string }
  const answer = await callTool(
    "airdesign_execute",
    {
      deck,
      script: `
        const s = insert({ kind: "slide" })
        const rows = ["Annual-prepay discount", "Seat floor on renewals", "Usage tier for API calls"]
        const placed = rows.flatMap((row, i) => {
          const y = 300 + i * 120
          const badge = insert({ parent: s, kind: "text", text: String(i + 1), align: "center", alignV: "center", fill: "background2", box: { x: 120, y, w: 56, h: 56 } })
          const words = insert({ parent: s, kind: "text", text: row, alignV: "center", box: { x: 200, y, w: 900, h: 56 } })
          return [badge, words].map((id) => get({ target: id }).box).map((b) => [b.y, b.h])
        })
        ;({ placed, problems: get({ target: s }).problems })
      `,
    },
    { ...session, once: "call2" },
    host,
  )
  const fields = answer.fields as { result: { placed: number[][]; problems: unknown } }
  expect(answer.ok, JSON.stringify(fields)).toBe(true)
  expect(fields.result.placed).toEqual([
    [300, 56],
    [300, 56],
    [420, 56],
    [420, 56],
    [540, 56],
    [540, 56],
  ])
  expect(fields.result.problems).toEqual([])
})
