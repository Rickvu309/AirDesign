import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const titled = () =>
  doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom

function agent() {
  const decks = memoryDecks(titled)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
}

describe("a raw size and font over the protocol", () => {
  it("lands a font the catalog serves under its own name, and names a size off the scale", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = `${slides[0]!}.title`
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "set", target: title, font: "montserrat", size: 72 }],
    })
    expect(landed.ok).toBe(true)
    expect(landed.answer).toMatchObject({
      findings: [
        { code: "off-scale", size: 72, style: expect.any(String), to: expect.any(Number) },
        { code: "off-font", font: "Montserrat" },
      ],
    })
    const read = await call("read_deck", { deck })
    expect(String(read.answer.layers)).toContain('size=72 font="Montserrat"')
  })

  it("sets a weight the panel names, and reads the family and that weight", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = `${slides[0]!}.title`
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "set", target: title, weight: "ExtraBold" }],
    })
    expect(landed.ok).toBe(true)
    const read = await call("read_deck", { deck })
    expect(String(read.answer.layers)).toContain('font="Inter"')
    expect(String(read.answer.layers)).toContain("weight=ExtraBold")
    expect(String(read.answer.layers)).not.toContain("Inter ExtraBold")
  })

  it("refuses a font the catalog does not serve, and lands nothing", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const unknown = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "set", target: `${slides[0]!}.title`, font: "Nowhere Grotesk" }],
    })
    expect(unknown.answer).toMatchObject({ ok: false, refusal: "field", field: "font", at: 0 })
    expect(String(unknown.answer.note)).toContain(
      "Nowhere Grotesk is not in AirDesign's font catalog, so nothing landed.",
    )
    expect((await call("read_deck", { deck })).answer.rev).toBe(rev)
  })
  it("sets the theme's fonts under the catalog's own names, and refuses a family it does not serve", async () => {
    const call = agent()
    const { deck, rev } = (await call("create_deck", {})).answer as { deck: string; rev: number }
    const themed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "deck", name: "Board", fonts: { heading: "lora" } }],
    })
    expect(themed.ok).toBe(true)
    expect((await call("read_deck", { deck })).answer).toMatchObject({ theme: { fonts: { heading: "Lora" } } })
    const unknown = await call("edit_deck", {
      deck,
      base: rev + 1,
      runId: (themed.answer as { runId: string }).runId,
      changes: [{ op: "deck", fonts: { body: "Nowhere Grotesk" } }],
    })
    expect(unknown.answer).toMatchObject({ ok: false, refusal: "field", field: "fonts.body", at: 0 })
    expect((await call("list_decks", {})).answer).toMatchObject({ decks: [{ deck, name: "Board" }] })
  })
})
