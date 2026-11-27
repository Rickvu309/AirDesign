import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { layoutOf } from "./layout-findings-answer.js"
import { readOf, scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"

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
              text: doom.textFromMarkdown("Revenue by region", "title"),
            },
          },
        ],
      },
    ],
  }).doom

const estimate = doom.measureWith({})
const measured = (missing: readonly string[] = []) => ({
  measure: estimate,
  missing: new Map([[doom.defaultTheme.fonts.body, new Set(missing)]]),
})

function agent(measure: DeckHost["measure"] = async () => measured()) {
  const host = { ...memoryDecks(titled), measure }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, host)
  }
}

type Found = { readonly code: string; readonly node: string; readonly with?: string; readonly note: string }

describe("layout findings in the answers, measured by the host with the deck's fonts and no open tab", () => {
  it("lands an edit that covers the title's words and names the overlap on the slide it touched", async () => {
    const call = agent()
    const { deck, rev, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const title = String((await readOf(call, deck)).fields.layers)
      .split("\n")[1]!
      .trim()
      .split(" ")[0]!
    const box = { x: 160, y: 400, w: 400, h: 100 }
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box, fill: "accent2" }]),
    })
    expect(landed.ok).toBe(true)
    const answer = landed.fields as { rev: number; note: string; made: { ids: string[] }[]; problems: Found[] }
    expect(answer.rev).toBe(rev + 1)
    expect(answer.problems).toMatchObject([{ code: "overlap", node: title }])
    expect(answer.problems[0]!.note).toContain(answer.made[0]!.ids[0]!)
    expect(answer.note).toContain("fix it unless the person asked for it")
  })

  it("reads each layer at the size it paints and lists the problems of the slides it read", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box: { x: 1800, y: 900, w: 300, h: 100 } }]),
    })
    const read = (await readOf(call, deck)).fields as { layers: string; problems: Found[] }
    const title = estimate(doom.textFromMarkdown("Revenue by region", "title"), doom.defaultTheme, 1600).h
    expect(read.layers.split("\n")[1]).toContain(`1600x${String(Number(title.toFixed(1)))}`)
    expect(read.problems.map(({ code }) => code)).toEqual(["off-slide"])
  })

  it("says the layout is clear when the slides it touched paint with nothing off, so the agent need not guess", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box: { x: 160, y: 700, w: 400, h: 100 } }]),
    })
    expect(landed.fields.problems).toEqual([])
    expect(String(landed.fields.note)).toContain(
      "Layout clear: no overflow, overlap, line crossings, off-slide or small text.",
    )
  })

  const unchecked = async (measure: DeckHost["measure"]) => {
    const call = agent(measure)
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box: { x: 160, y: 700, w: 400, h: 100 } }]),
    })
    expect(landed.ok).toBe(true)
    expect(landed.fields.problems).toEqual([])
    return String(landed.fields.note)
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
        missing: new Map(),
      })),
    ).toContain("The layout went unchecked: it could not be worked out")
  })

  it("names only the texts whose letters the fonts lack, and still checks the rest of the slide", async () => {
    const call = agent(async () => measured(["🚀"]))
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const landed = await call("execute", {
      deck,
      script: scriptOf([
        { op: "add", kind: "text", slide: slides[0], text: "Launch 🚀", box: { x: 160, y: 700, w: 600, h: 60 } },
        { op: "add", kind: "shape", slide: slides[0], box: { x: 1850, y: 900, w: 200, h: 100 } },
      ]),
    })
    const answer = landed.fields as { note: string; made: { ids: string[] }[]; problems: Found[] }
    expect(answer.problems).toMatchObject([{ code: "off-slide", node: answer.made[1]!.ids[0]! }])
    expect(answer.note).toContain(
      `${answer.made[0]!.ids[0]!} has a character the deck's fonts lack, so its overflow and overlap are unknown. Check it by eye, or change the font or the character.`,
    )
    expect(answer.note).not.toContain("Layout clear")
  })

  it("lists at most ten problems and says how many more the call holds", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
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
    const landed = await call("execute", { deck, script: scriptOf(off) })
    const answer = landed.fields as { note: string; problems: Found[] }
    expect(answer.problems).toHaveLength(10)
    expect(answer.problems[0]).toEqual({ code: "off-slide", node: expect.any(String), note: expect.any(String) })
    expect(answer.note).toContain("2 more are not listed")
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

describe("the note on texts the fonts cannot measure", () => {
  const texts = (count: number) =>
    Array.from({ length: count }, (_, at) => ({ op: "add", kind: "text", text: `Launch ${String(at)} 🚀` }))

  it("names every text up to five, then counts the rest, in the right number", async () => {
    const note = async (count: number) => {
      const call = agent(async () => measured(["🚀"]))
      const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
        deck: string
        rev: number
        slides: string[]
      }
      const changes = texts(count).map((change) => ({ ...change, slide: slides[0] }))
      const landed = await call("execute", { deck, script: scriptOf(changes) })
      const { made } = landed.fields as { made: { ids: string[] }[] }
      return { note: String(landed.fields.note), ids: made.flatMap((each) => each.ids) }
    }
    const two = await note(2)
    expect(two.note).toContain(
      `${two.ids[0]!} and ${two.ids[1]!} have characters the deck's fonts lack, so their overflow and overlap are unknown. Check them by eye, or change the font or the characters.`,
    )
    const seven = await note(7)
    expect(seven.note).toContain(`${seven.ids.slice(0, 5).join(", ")} and 2 more have characters`)
  })
})
