import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, emptyLog, type DeckHost, type Session, type ToolResult } from "./index.js"
import { readOf, scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>
const logo = "https://images.example.com/logo.png"
const stored = "c".repeat(64)

function start(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      { name: "One", children: [] },
      { name: "Two", children: [] },
    ],
  }).doom
}

function agent(overrides: (decks: ReturnType<typeof memoryDecks>) => Partial<DeckHost> = () => ({})) {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, ...overrides(decks) }
  let minted = 0
  const session: Session = { agent: "aira", mint: () => `m${String((minted += 1))}`, log: emptyLog(), now: 0 }
  let calls = 0
  return {
    decks,
    call: async (op: string, args: unknown): Promise<ToolResult> => {
      session.once = `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, host)
    },
  }
}

async function deckOf(by: ReturnType<typeof agent>) {
  const made = await by.call("create_deck", {})
  const answer = made.answer as { deck: string; rev: number; slides: string[] }
  return answer
}

const addPicture = (slide: string, image: string, more: Record<string, unknown> = {}) => ({
  op: "add",
  kind: "picture",
  slide,
  fill: { image },
  ...more,
})

describe("an image an agent names that is no address and no stored asset", () => {
  it("is refused, naming the change and why, and nothing lands", async () => {
    const by = agent()
    const made = await deckOf(by)
    const sent = await by.call("execute", {
      deck: made.deck,
      script: scriptOf([addPicture(made.slides[0]!, "logo.png")]),
    })
    expect(sent.ok).toBe(false)
    expect(sent.answer.note).toContain('Operation 1 (insert) at line 1: "logo.png" was not used because')
    expect(sent.answer.note).toContain("https address")
    const [{ rev }] = [await by.decks.open(made.deck as never)] as [{ rev: number }]
    expect(rev).toBe(made.rev)
  })

  it("is refused for a stored-looking hash the deck does not hold", async () => {
    const by = agent(() => ({
      images: async (_deck, wanted) => new Map(wanted.map((each) => [each, { ok: false, refusal: "absent" } as const])),
    }))
    const made = await deckOf(by)
    const sent = await by.call("execute", {
      deck: made.deck,
      script: scriptOf([addPicture(made.slides[0]!, stored)]),
    })
    expect(sent.ok).toBe(false)
    expect(sent.answer.note).toContain(
      `Operation 1 (insert) at line 1: "${stored}" was not used because this deck holds`,
    )
  })

  it("lands for a hash the deck holds", async () => {
    const by = agent(() => ({
      images: async (_deck, wanted) =>
        new Map(wanted.map((each) => [each, { ok: true, asset: each, width: 300, height: 200 } as const])),
    }))
    const made = await deckOf(by)
    const sent = await by.call("execute", {
      deck: made.deck,
      script: scriptOf([addPicture(made.slides[0]!, stored)]),
    })
    expect(sent.ok).toBe(true)
  })
})

describe("a picture an agent adds with no box", () => {
  it("is sized to its own shape, not stretched over the free area", async () => {
    const by = agent(() => ({
      images: async () => new Map([[logo, { ok: true, asset: stored, width: 4000, height: 1000 } as const]]),
    }))
    const made = await deckOf(by)
    const sent = await by.call("execute", {
      deck: made.deck,
      script: scriptOf([addPicture(made.slides[0]!, logo)]),
    })
    expect(sent.ok).toBe(true)
    const [{ fold }] = [await by.decks.open(made.deck as never)] as [{ fold: doom.Doom }]
    const added = (sent.answer.made as { ids: string[] }[])[0]!.ids[0] as doom.NodeId
    const box = (fold.nodes.get(added) as { box: { w: number; h: number } }).box
    expect(box.w / box.h).toBeCloseTo(4, 1)
  })
})

describe("screenshot in execute", () => {
  const shot = "/9j/AAAA"
  const shots = (slides: readonly string[]) => slides.map((slide) => `screenshot({ target: "${slide}" })`).join("\n")

  it("adds a picture of each slide that has a current one", async () => {
    const by = agent(() => ({
      pictures: async (_deck, _fold, slides) => new Map(slides.map((slide) => [slide, shot])),
    }))
    const made = await deckOf(by)
    const read = await by.call("execute", { deck: made.deck, script: shots(made.slides) })
    expect(read.ok).toBe(true)
    const images = read.content.filter((block) => block.type === "image")
    expect(images).toHaveLength(2)
    expect(images[0]).toMatchObject({ type: "image", data: shot, mimeType: "image/jpeg" })
  })

  it("says plainly which slides have no current picture yet", async () => {
    const by = agent(() => ({
      pictures: async (_deck, _fold, slides) => new Map(slides.slice(0, 1).map((slide) => [slide, shot])),
    }))
    const made = await deckOf(by)
    const read = await by.call("execute", { deck: made.deck, script: shots(made.slides) })
    expect(read.content.filter((block) => block.type === "image")).toHaveLength(1)
    expect(read.answer.pictures).toEqual([made.slides[0]])
    expect(read.answer.note).toContain(`No picture of ${made.slides[1]!} yet`)
    expect(read.answer.note).toContain("open AirDesign tab")
  })

  it("asks for no picture when the script takes none", async () => {
    let asked = 0
    const by = agent(() => ({
      pictures: async () => {
        asked += 1
        return new Map()
      },
    }))
    const made = await deckOf(by)
    const read = await readOf(by.call, made.deck)
    expect(read.ok).toBe(true)
    expect(asked).toBe(0)
  })

  it("asks only for the slide named", async () => {
    let wanted: readonly string[] = []
    const by = agent(() => ({
      pictures: async (_deck, _fold, slides) => {
        wanted = slides
        return new Map()
      },
    }))
    const made = await deckOf(by)
    await by.call("execute", { deck: made.deck, script: shots([made.slides[1]!]) })
    expect(wanted).toEqual([made.slides[1]])
  })
})
