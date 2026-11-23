import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type DeckHost, type Session } from "./index.js"
import { layoutOf } from "./layout-answer.js"
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
const measured = (missing: readonly string[] = []) => ({ measure: estimate, missing: new Set(missing) })

function agent(measure: DeckHost["measure"] = async () => measured()) {
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
    expect(answer.findings).toMatchObject([{ code: "overlap", node: title }])
    expect(answer.findings[0]!.note).toContain(answer.added[0]!.id)
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
    const title = estimate(doom.textFromMarkdown("Untitled", "title"), doom.defaultTheme, 1600).h
    expect(read.layers.split("\n")[1]).toContain(`1600x${String(Number(title.toFixed(1)))}`)
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
    expect(String(landed.answer.note)).toContain("Layout clear: no overflow, overlap, off-slide or small text.")
  })

  const unchecked = async (measure: DeckHost["measure"]) => {
    const call = agent(measure)
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
    expect(landed.ok).toBe(true)
    expect(landed.answer).not.toHaveProperty("findings")
    return String(landed.answer.note)
  }

  it("lands the edit and says why the layout went unchecked: fonts, time or a fault", async () => {
    expect(await unchecked(async () => "fonts")).toContain(
      "The layout went unchecked: the deck's fonts could not be read",
    )
    expect(await unchecked(async () => "time")).toContain("the fonts took too long to load")
    expect(await unchecked(async () => measured())).toContain("Layout clear")
    expect(
      await unchecked(async () => ({
        measure: () => {
          throw new Error("measure broke")
        },
        missing: new Set<string>(),
      })),
    ).toContain("The layout went unchecked: it could not be worked out")
  })

  it("names only the texts whose letters the fonts lack, and still checks the rest of the slide", async () => {
    const call = agent(async () => measured(["🚀"]))
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("edit_deck", {
      deck,
      base: rev,
      changes: [
        { op: "add", kind: "text", slide: slides[0], text: "Launch 🚀", box: { x: 160, y: 700, w: 600, h: 60 } },
        { op: "add", kind: "shape", slide: slides[0], box: { x: 1850, y: 900, w: 200, h: 100 } },
      ],
    })
    const answer = landed.answer as { note: string; added: { id: string }[]; findings: Found[] }
    expect(answer.findings).toMatchObject([{ code: "off-slide", node: answer.added[1]!.id }])
    expect(answer.note).toContain(`1 text could not be measured`)
    expect(answer.note).toContain(answer.added[0]!.id)
    expect(answer.note).not.toContain("Layout clear")
  })

  it("lists at most ten findings and says how many more the read holds", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("create_deck", {})).answer as {
      deck: string
      rev: number
      slides: string[]
    }
    const off = Array.from({ length: 12 }, (_, at) => ({
      op: "add",
      kind: "shape",
      slide: slides[0],
      box: { x: 1850, y: at * 80, w: 200, h: 60 },
    }))
    const landed = await call("edit_deck", { deck, base: rev, changes: off })
    const answer = landed.answer as { note: string; findings: Found[] }
    expect(answer.findings).toHaveLength(10)
    expect(answer.findings[0]).toEqual({ code: "off-slide", node: expect.any(String), note: expect.any(String) })
    expect(answer.note).toContain("2 more findings")
  })
})

describe("the layout call never fails a landed edit", () => {
  it("answers a fault when working out the touched slides throws", async () => {
    const host = { ...memoryDecks(titled), measure: async () => measured() }
    const laid = await layoutOf(host, titled(), () => {
      throw new Error("touched broke")
    })
    expect(laid).toEqual({ findings: [], layout: "fault" })
  })
})
