import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"
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
    const made = await by.call("execute", { script: "createDeck()" })
    const { deck, slides } = made.fields as { deck: string; slides: string[] }
    const refused = await by.call("execute", { deck, script: scriptOf([{ ...hiddenCaption, slide: slides[0] }]) })
    expect(refused.fields).toMatchObject({
      ok: false,
      refusal: "field",
      refused: "shape",
      field: "text",
      fault: "form",
      form: "A non-empty string.",
      op: 1,
      verb: "insert",
      line: 1,
    })
    expect(refused.fields.note).toBe(
      "Nothing landed. Operation 1 (insert) at line 1: field text. The wrong form. Accepted form: A non-empty string.",
    )
  })

  it("names an empty script, an unknown argument, a bad run id and a missing deck", async () => {
    const by = agent()
    const made = await by.call("execute", { script: "createDeck()" })
    const { deck, slides } = made.fields as { deck: string; slides: string[] }
    const runForm = "The runId a call answered: 1 to 64 of letters, digits, _ or -."
    const empty = await by.call("execute", { deck, script: "" })
    expect(empty.fields).toMatchObject({
      ok: false,
      refusal: "field",
      field: "script",
      fault: "form",
      form: "JavaScript, 1 to 100,000 characters.",
    })
    expect(empty.fields.note).toBe("field script. The wrong form. Accepted form: JavaScript, 1 to 100,000 characters.")
    const extra = await by.call("execute", { deck, extra: 1, script: "get()" })
    expect(extra.fields).toMatchObject({
      refusal: "field",
      field: "extra",
      fault: "unknown",
      form: "One of deck, script, runId.",
    })
    expect(extra.fields.note).toBe("field extra. Unknown. Accepted form: One of deck, script, runId.")
    const run = await by.call("execute", { deck, runId: "bad id!", script: "get()" })
    expect(run.fields).toMatchObject({ refusal: "field", field: "runId", fault: "form", form: runForm })
    expect(run.fields.note).toBe(`field runId. The wrong form. Accepted form: ${runForm}`)
    const deckless = await by.call("execute", { script: "get()" })
    expect(deckless.fields).toMatchObject({ refusal: "field" })
    const added = await by.call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "text", slide: slides[0], text: "Hi" }]),
    })
    const id = (added.fields as { made: { ids: string[] }[] }).made[0]!.ids[0]!
    const arrow = await by.call("execute", { deck, script: scriptOf([{ op: "set", target: id, arrow: true }]) })
    expect(arrow.fields).toMatchObject({ field: "arrow", fault: "needs", needs: "a line" })
    expect(arrow.fields).not.toHaveProperty("form")
    expect(String(arrow.fields.note)).toContain("Needs a line.")
    expect(String(arrow.fields.note)).not.toContain("Accepted form")
  })
})
