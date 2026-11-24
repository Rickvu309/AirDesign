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
  let calls = 0
  return {
    call: (op: string, args: unknown) => {
      calls += 1
      session.once = `once${String(calls)}`
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

  it("names an empty batch, an unknown argument, a bad run id and a missing deck", async () => {
    const by = agent()
    const made = await by.call("create_deck", {})
    const { deck, rev, slides } = made.answer as { deck: string; rev: number; slides: string[] }
    const idForm = "1 to 64 of letters, digits, _ or -."
    const empty = await by.call("edit_deck", { deck, base: rev, changes: [] })
    expect(empty.answer).toMatchObject({
      ok: false,
      refusal: "batch",
      field: "changes",
      fault: "form",
      form: "1 to 100 changes.",
    })
    expect(empty.answer.note).toBe("field changes. The wrong form. Accepted form: 1 to 100 changes.")
    const extra = await by.call("edit_deck", { deck, base: rev, extra: 1, changes: [{ op: "add" }] })
    expect(extra.answer).toMatchObject({
      refusal: "field",
      field: "extra",
      fault: "unknown",
      form: "One of deck, base, runId, changes.",
    })
    expect(extra.answer.note).toBe("field extra. Unknown. Accepted form: One of deck, base, runId, changes.")
    const run = await by.call("edit_deck", { deck, base: rev, runId: "bad id!", changes: [{ op: "add" }] })
    expect(run.answer).toMatchObject({ refusal: "field", field: "runId", fault: "form", form: idForm })
    expect(run.answer.note).toBe(`field runId. The wrong form. Accepted form: ${idForm}`)
    const deckless = await by.call("edit_deck", { base: rev, changes: [{ op: "add" }] })
    expect(deckless.answer).toMatchObject({ refusal: "field", field: "deck", fault: "missing", form: idForm })
    expect(deckless.answer.note).toBe(`field deck. Missing. Accepted form: ${idForm}`)
    const added = await by.call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "add", kind: "text", slide: slides[0], text: "Hi" }],
    })
    const id = (added.answer as { added: { id: string }[]; rev: number }).added[0]!.id
    const next = (added.answer as { rev: number }).rev
    const arrow = await by.call("edit_deck", { deck, base: next, changes: [{ op: "set", target: id, arrow: true }] })
    expect(arrow.answer).toMatchObject({ field: "arrow", fault: "needs", needs: "a line" })
    expect(arrow.answer).not.toHaveProperty("form")
    expect(String(arrow.answer.note)).toContain("Needs a line.")
    expect(String(arrow.answer.note)).not.toContain("Accepted form")
  })
})
