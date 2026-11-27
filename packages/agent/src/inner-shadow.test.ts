import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: testTheme,
    slides: [{ name: "Title", children: [{ type: "shape", name: "Card" }] }],
  }).doom
}

function sessionFor(): Session {
  let minted = 0
  return { agent: "aira", mint: () => `minted${String((minted += 1))}` }
}

describe("inner shadow over the protocol", () => {
  it("writes an inner shadow, reads it back, and names a bad field", async () => {
    const session = sessionFor()
    const host = memoryDecks(started)
    const call = async (name: string, args: Record<string, unknown>) =>
      (await callTool(`airdesign_${name}`, args, session, host)).fields as Record<string, any>
    const made = await call("execute", { script: 'createDeck({ name: "Shadow" })' })
    const slide = (made.slides as string[])[0]!
    const edited = await call("execute", {
      deck: made.deck,
      script: scriptOf([
        {
          op: "add",
          kind: "shape",
          slide,
          fill: "accent1",
          innerShadow: { color: "accent1", x: 0, y: 2, blur: 4, spread: 1, opacity: 0.4 },
        },
      ]),
    })
    expect(edited).toMatchObject({ ok: true })
    expect((await call("execute", { deck: made.deck, script: "get().layers" })).result).toContain(
      "innerShadow=accent1,0,2,4,1@0.4",
    )
    const bad = await call("execute", {
      deck: made.deck,
      script: scriptOf([{ op: "set", target: slide, innerShadow: { color: "nope", x: 0, y: 0, blur: 0, spread: 0 } }]),
    })
    expect(bad).toMatchObject({ ok: false, field: "innerShadow.color" })
  })
})
