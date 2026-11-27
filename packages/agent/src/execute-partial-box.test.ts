import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom

it("update and move take only the box fields that change and keep the rest", async () => {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: doom.measureWith({}), missing: new Map() }) }
  const session: Session = { agent: "aira", once: "call1", mint: () => "minted" }
  const made = await callTool("airdesign_execute", { script: "createDeck()" }, session, host)
  const { deck } = made.fields as { deck: string }
  const boxOf = `(id) => { const b = get({ target: id }).box; return [b.x, b.y, b.w, b.h] }`
  const answer = await callTool(
    "airdesign_execute",
    {
      deck,
      script: `
        const boxOf = ${boxOf}
        const s = insert({ kind: "slide" })
        const card = insert({ parent: s, kind: "shape", shape: "rect", box: { x: 100, y: 200, w: 300, h: 400 } })
        update({ target: card, box: { x: 120, y: 240, w: 540 } })
        const updated = boxOf(card)
        move({ target: card, box: { y: 500 } })
        ;[updated, boxOf(card)]
      `,
    },
    { ...session, once: "call2" },
    host,
  )
  const fields = answer.fields as { result: unknown }
  expect(answer.ok, JSON.stringify(fields)).toBe(true)
  expect(fields.result).toEqual([
    [120, 240, 540, 400],
    [120, 500, 540, 400],
  ])
})
