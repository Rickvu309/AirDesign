import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session } from "./index.js"
import { readOf, scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const titled = () =>
  doom.doomFromTree({
    theme: testTheme,
    slides: [
      {
        name: "Title",
        children: [
          {
            type: "shape",
            name: "Title",
            props: { role: "title", text: doom.textFromMarkdown("Sales grew", "title") },
          },
        ],
      },
    ],
  }).doom

function agent() {
  const decks = memoryDecks(titled)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
}

describe("a raw size and font over the protocol", () => {
  it("lands a font the catalog serves under its own name, and names a size off the scale", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = `${slides[0]!}.title`
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "update", target: title, font: "montserrat", size: 72 }]),
    })
    expect(landed.ok).toBe(true)
    expect(landed.fields).toMatchObject({
      problems: [
        { code: "off-scale", size: 72, style: expect.any(String), to: expect.any(Number) },
        { code: "off-font", font: "Montserrat" },
      ],
    })
    const read = await readOf(call, deck)
    expect(String(read.fields.layers)).toContain('size=72 font="Montserrat"')
  })

  it("sets a weight the panel names, and reads the family and that weight", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = `${slides[0]!}.title`
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "update", target: title, weight: "ExtraBold" }]),
    })
    expect(landed.ok).toBe(true)
    const read = await readOf(call, deck)
    expect(String(read.fields.layers)).toContain('font="Inter"')
    expect(String(read.fields.layers)).toContain("weight=ExtraBold")
    expect(String(read.fields.layers)).not.toContain("Inter ExtraBold")
  })

  it("names no off-font problem for a weight set on the deck's own family", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    let base = rev
    for (const weight of ["Medium", "ExtraBold", "Regular", "Bold"]) {
      const landed = await call("execute", {
        deck,
        script: scriptOf([{ op: "update", target: `${slides[0]!}.title`, weight }]),
      })
      expect(landed.ok).toBe(true)
      expect(JSON.stringify(landed.fields)).not.toContain("off-font")
      base += 1
    }
  })

  it("refuses a font the catalog does not serve, and lands nothing", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const unknown = await call("execute", {
      deck,
      script: scriptOf([{ op: "update", target: `${slides[0]!}.title`, font: "Nowhere Grotesk" }]),
    })
    expect(unknown.fields).toMatchObject({ ok: false, refusal: "field", field: "font", op: 1 })
    expect(String(unknown.fields.note)).toContain(
      "Nowhere Grotesk is not in AirDesign's font catalog, so nothing landed.",
    )
    expect((await readOf(call, deck)).fields.rev).toBe(rev)
  })
  it("sets the theme's fonts under the catalog's own names, and refuses a family it does not serve", async () => {
    const call = agent()
    const { deck } = (await call("execute", { script: "createDeck()" })).fields as { deck: string; rev: number }
    const themed = await call("execute", {
      deck,
      script: scriptOf([{ op: "variables", name: "Board", fonts: { heading: "lora" } }]),
    })
    expect(themed.ok).toBe(true)
    expect((await readOf(call, deck)).fields).toMatchObject({ theme: { fonts: { heading: "Lora" } } })
    const unknown = await call("execute", {
      deck,
      runId: (themed.fields as { runId: string }).runId,
      script: scriptOf([{ op: "variables", fonts: { body: "Nowhere Grotesk" } }]),
    })
    expect(unknown.fields).toMatchObject({ ok: false, refusal: "field", field: "fonts.body", op: 1 })
    expect((await call("get_app_state", {})).fields).toMatchObject({ decks: [{ deck, name: "Board" }] })
  })
})
