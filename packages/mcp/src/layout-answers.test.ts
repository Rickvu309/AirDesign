import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const titled = () =>
  doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          {
            type: "shape",
            name: "Title",
            props: {
              role: "title",
              box: { x: 160, y: 380, w: 1600, h: 160, rotation: 0, flipH: false, flipV: false },
              text: doom.textFromMarkdown("Untitled", "title"),
            },
          },
        ],
      },
    ],
  }).doom

const estimate = doom.measureWith({})

function agent(measure: DeckHost["measure"] = async () => estimate) {
  const host = { ...memoryDecks(titled), measure }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, host)
  }
}

type Found = { readonly code: string; readonly node: string; readonly with?: string; readonly note: string }

describe("layout findings in the answers, measured by the host with the deck's fonts and no open tab", () => {
  it("lands an edit that covers the title's words and names the overlap on the slide it touched", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = String((await call("read_deck", { deck })).answer.layers)
      .split("\n")[1]!
      .trim()
      .split(" ")[0]!
    const box = { x: 160, y: 400, w: 400, h: 100 }
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "add", kind: "shape", slide: slides[0], box, fill: "accent2" }],
    })
    expect(landed.ok).toBe(true)
    const answer = landed.answer as { rev: number; note: string; added: { id: string }[]; findings: Found[] }
    expect(answer.rev).toBe(rev + 1)
    expect(answer.findings).toMatchObject([{ code: "overlap", node: title, with: answer.added[0]!.id }])
    expect(answer.note).toContain("fix it unless the person asked for it")
  })

  it("reads each layer at the size it paints and lists the findings of the slides it read", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "add", kind: "shape", slide: slides[0], box: { x: 1800, y: 900, w: 300, h: 100 } }],
    })
    const read = (await call("read_deck", { deck })).answer as { layers: string; findings: Found[] }
    expect(read.layers.split("\n")[1]).toContain("1600x96.8")
    expect(read.findings).toMatchObject([{ code: "off-slide" }])
  })

  it("says the layout is clear when the slides it touched paint with nothing off, so the agent need not guess", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "add", kind: "shape", slide: slides[0], box: { x: 160, y: 700, w: 400, h: 100 } }],
    })
    expect(landed.answer).not.toHaveProperty("findings")
    expect(String(landed.answer.note)).toContain("Laid out with the deck's own fonts, no words overflow or overlap")
  })

  it("says the layout went unchecked when the host could not read the deck's fonts, and lands the edit", async () => {
    const call = agent(async () => undefined)
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [{ op: "add", kind: "shape", slide: slides[0], box: { x: 160, y: 400, w: 400, h: 100 } }],
    })
    expect(landed.ok).toBe(true)
    expect(landed.answer).not.toHaveProperty("findings")
    expect(String(landed.answer.note)).toContain("The layout went unchecked")
  })
})
