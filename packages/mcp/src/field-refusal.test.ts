import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { memoryDecks } from "./memory-decks.js"
import { catalog, projectTools } from "@airdesign/catalog"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function agent() {
  const session: Session = { agent: "aira", mint: () => "m1", log: emptyLog(), now: 0 }
  const decks = memoryDecks(
    () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom,
  )
  return {
    call: (op: string, args: unknown) => {
      session.once = "once"
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

const hiddenCaption = {
  op: "add",
  kind: "text",
  slide: "m1jx7i64jma5:5",
  textStyle: "caption",
  text: "",
  box: { x: 0, y: 0, w: 10, h: 10 },
  hidden: true,
}

describe("an agent reads the field a refusal names", () => {
  it("says which field of the empty hidden caption was the wrong form, and the form it accepts", async () => {
    const by = agent()
    const made = await by.call("create_deck", {})
    const { deck, rev } = made.answer as { deck: string; rev: number }
    const refused = await by.call("edit_deck", { deck, base: rev, changes: [hiddenCaption] })
    expect(refused.answer).toMatchObject({
      ok: false,
      refusal: "field",
      refused: "shape",
      field: "text",
      fault: "form",
      form: "A non-empty string.",
      at: 0,
    })
    expect(refused.answer.note).toBe("Change 1 (add): field text. The wrong form. Accepted form: A non-empty string.")
  })
})
