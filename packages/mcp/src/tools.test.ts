import { catalog, projectTools } from "@airdesign/catalog"
import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"

import { emptyLog, memoryDecks, callTool, type MemoryDecks, type Session, type ToolResult } from "./index.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function start(): scene.Scene {
  return scene.sceneFromTree({
    theme: scene.defaultTheme,
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
              text: scene.textFromMarkdown("Untitled", "title"),
            },
          },
        ],
      },
    ],
  }).scene
}

function agent(decks: MemoryDecks = memoryDecks(start), id = "aira") {
  let minted = 0
  const session: Session = { agent: id, mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  let calls = 0
  return {
    decks,
    call: async (op: string, args: unknown, once?: string): Promise<ToolResult> => {
      session.once = once ?? `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

async function created(by: ReturnType<typeof agent>) {
  const made = await by.call("create_deck", {})
  return made.answer as { deck: string; rev: number; slides: string[] }
}

const edit = (deck: string, base: number, changes: unknown[], runId?: string) => ({
  deck,
  base,
  changes,
  ...(runId === undefined ? {} : { runId }),
})

const person: scene.Author = { kind: "person", id: "quan" }

describe("create_deck and list_decks", () => {
  it("makes a deck and answers its id, name and first read", async () => {
    const by = agent()
    const made = await by.call("create_deck", { name: "Board" })
    expect(made.ok).toBe(true)
    expect(made.answer).toMatchObject({
      ok: true,
      rev: expect.any(Number),
      name: "Board",
      slides: [expect.any(String)],
    })
    expect(made.content.map((block) => block.text).join("\n")).toContain("Untitled")
    expect(by.decks.decks.size).toBe(1)
  })

  it("makes one deck for a call sent again with the same once", async () => {
    const by = agent()
    const first = await by.call("create_deck", {}, "same")
    const again = await by.call("create_deck", {}, "same")
    expect(again.answer).toEqual(first.answer)
    expect(by.decks.decks.size).toBe(1)
  })

  it("lists the decks with id, name and rev", async () => {
    const by = agent()
    const made = await created(by)
    const listed = await by.call("list_decks", {})
    expect(listed.answer).toEqual({ ok: true, decks: [{ deck: made.deck, name: "Blank deck", rev: made.rev }] })
  })

  it("refuses a field it does not take", async () => {
    const by = agent()
    expect((await by.call("create_deck", { template: "neutral" })).answer).toEqual({ ok: false, refusal: "field" })
    expect((await by.call("list_decks", { deck: "x" })).answer).toEqual({ ok: false, refusal: "field" })
  })
})

describe("read_deck", () => {
  it("prints a line for each layer and answers the rev to send as base", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const read = await by.call("read_deck", { deck })
    expect(read.answer).toMatchObject({ ok: true, deck, rev, slides })
    const lines = (read.content[1]?.text ?? "").split("\n")
    expect(lines[0]).toMatch(/^slide /)
    expect(lines[1]).toMatch(/^ {2}\S+ text:title @160,380 1600x160 .*text="Untitled"/)
  })

  it("reads one slide, and refuses a slide the deck does not have", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const one = await by.call("read_deck", { deck, slide: slides[0] })
    expect(one.ok).toBe(true)
    const none = await by.call("read_deck", { deck, slide: "z:9" })
    expect(none.answer).toMatchObject({ ok: false, refusal: "dead", node: "z:9" })
  })

  it("pages a long deck by slide with next, and the next page continues from it", async () => {
    const by = agent()
    const { deck, rev } = await created(by)
    const words = "word ".repeat(1_200).trim()
    const added = await by.call(
      "edit_deck",
      edit(
        deck,
        rev,
        Array.from({ length: 12 }, () => ({ op: "slide", add: {} })),
      ),
    )
    const slides = (await by.call("read_deck", { deck })).answer.slides as string[]
    const filled = await by.call(
      "edit_deck",
      edit(
        deck,
        (added.answer as { rev: number }).rev,
        slides.map((slide) => ({ op: "add", kind: "text", slide, text: words, box: { x: 0, y: 0, w: 1920, h: 900 } })),
      ),
    )
    expect(filled.ok).toBe(true)
    const first = await by.call("read_deck", { deck })
    const next = (first.answer as { next?: string }).next
    expect(next).toBeDefined()
    const rest = await by.call("read_deck", { deck, cursor: next })
    expect((rest.content[1]?.text ?? "").split("\n")[0]).toContain(next)
    expect(first.content[1]!.text).not.toContain(`slide ${next}`)
  })

  it("refuses an unknown deck", async () => {
    const by = agent()
    expect((await by.call("read_deck", { deck: "nothere" })).answer).toEqual({ ok: false, refusal: "deck" })
  })
})

describe("edit_deck", () => {
  it("starts a run, lands the changes at the next rev and answers the ids it added", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const landed = await by.call(
      "edit_deck",
      edit(deck, rev, [{ op: "add", kind: "text", slide: slides[0], text: "Hello **there**", textStyle: "heading" }]),
    )
    expect(landed.answer).toMatchObject({
      ok: true,
      deck,
      rev: rev + 1,
      runId: expect.any(String),
      added: [expect.stringMatching(/^m\w+:1$/)],
    })
    const fold = by.decks.decks.get(deck as never)!
    expect(fold.runs.get((landed.answer as { runId: string }).runId)?.phase).toBe("running")
    const read = await by.call("read_deck", { deck })
    expect(read.content[1]!.text).toContain('text="Hello **there**"')
  })

  it("answers only the root of what a pattern added", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const landed = await by.call(
      "edit_deck",
      edit(deck, rev, [
        {
          op: "add",
          kind: "kpi",
          slide: slides[0],
          items: [
            { title: "Revenue", value: "$4M" },
            { title: "Margin", value: "31%" },
          ],
        },
      ]),
    )
    expect((landed.answer as { added: string[] }).added).toHaveLength(1)
    const fold = by.decks.decks.get(deck as never)!
    expect(fold.nodes.size).toBeGreaterThan(8)
  })

  it("lands a second edit in the same run, and an edit with no runId in a new one", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call(
      "edit_deck",
      edit(deck, rev, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]),
    )
    const { runId } = first.answer as { runId: string }
    const second = await by.call(
      "edit_deck",
      edit(deck, rev + 1, [{ op: "add", kind: "text", slide: slides[0], text: "B" }], runId),
    )
    expect(second.answer).toMatchObject({ ok: true, rev: rev + 2, runId })
    const third = await by.call(
      "edit_deck",
      edit(deck, rev + 2, [{ op: "add", kind: "text", slide: slides[0], text: "C" }]),
    )
    expect((third.answer as { runId: string }).runId).not.toBe(runId)
  })

  it("lands none of a batch when one change is refused, and names the change, its place and the field", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const refused = await by.call(
      "edit_deck",
      edit(deck, rev, [
        { op: "add", kind: "text", slide: slides[0], text: "A" },
        { op: "set", target: "z:9", text: "B" },
      ]),
    )
    expect(refused.ok).toBe(false)
    expect(refused.answer).toMatchObject({
      ok: false,
      refusal: "dead",
      refused: "missing",
      change: "set z:9",
      at: 1,
      field: "target",
      node: "z:9",
    })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev)
    expect(refused.content[0]!.text).toContain("Change 2 (set z:9)")
  })

  it("names the change that has a field the op does not take", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const refused = await by.call(
      "edit_deck",
      edit(deck, rev, [
        { op: "add", kind: "text", slide: slides[0], text: "A" },
        { op: "add", kind: "line", slide: slides[0], text: "no" },
      ]),
    )
    expect(refused.answer).toMatchObject({
      ok: false,
      refusal: "field",
      refused: "shape",
      change: "add line",
      at: 1,
      field: "text",
    })
  })

  it("names the change whose form cannot be read", async () => {
    const by = agent()
    const { deck, rev } = await created(by)
    const refused = await by.call("edit_deck", edit(deck, rev, [{ op: "add", kind: "text", slide: "bad id" }]))
    expect(refused.answer).toMatchObject({ ok: false, refusal: "field", refused: "shape", change: "add", at: 0 })
  })

  it("refuses a base the deck has not reached, and a call with no changes or too many", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const change = { op: "add", kind: "text", slide: slides[0], text: "A" }
    expect((await by.call("edit_deck", edit(deck, rev + 5, [change]))).answer).toMatchObject({ refusal: "base", rev })
    expect((await by.call("edit_deck", edit(deck, rev, []))).answer).toEqual({ ok: false, refusal: "batch" })
    expect(
      (
        await by.call(
          "edit_deck",
          edit(
            deck,
            rev,
            Array.from({ length: 101 }, () => change),
          ),
        )
      ).answer,
    ).toEqual({ ok: false, refusal: "batch" })
    expect((await by.call("edit_deck", { deck, changes: [change] })).answer).toEqual({ ok: false, refusal: "base" })
    expect((await by.call("edit_deck", { ...edit(deck, rev, [change]), actor: "person" })).answer).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("answers a call sent again with the same once as the first time and lands it once", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const args = edit(deck, rev, [{ op: "add", kind: "kpi", slide: slides[0], items: [{ title: "A", value: "1" }] }])
    const first = await by.call("edit_deck", args, "again")
    const again = await by.call("edit_deck", args, "again")
    expect(again.answer).toEqual(first.answer)
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 1)
  })

  it("refuses text a person changed after the agent read it as stale, and lands it after a fresh read", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const fold = by.decks.decks.get(deck as never)!
    const node = fold.children.get(slides[0] as never)![0]!
    const typed = await by.decks.edit(deck as never, {
      once: "typed",
      author: person,
      writes: [
        {
          node,
          prop: "text",
          value: scene.textFromMarkdown("Typed", "title"),
          base: fold.revs.get(node)!.get("text")!,
        },
      ],
    })
    expect(typed).toMatchObject({ ok: true })
    const change = { op: "set", target: `${slides[0]}.title`, text: "Agent" }
    const stale = await by.call("edit_deck", edit(deck, rev, [change]))
    expect(stale.answer).toMatchObject({ ok: false, refusal: "stale", refused: "stale", prop: "text" })
    const fresh = await by.call("edit_deck", edit(deck, rev + 1, [change]))
    expect(fresh.ok).toBe(true)
  })

  it("closes a layer to the run once a person changes it, and opens it again in a new run", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call(
      "edit_deck",
      edit(deck, rev, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]),
    )
    const { runId, added } = first.answer as { runId: string; added: string[] }
    await by.decks.edit(deck as never, {
      once: "typed",
      author: person,
      writes: [{ node: added[0] as never, prop: "name", value: "Mine" }],
    })
    const closed = await by.call(
      "edit_deck",
      edit(deck, rev + 2, [{ op: "set", target: added[0], name: "Agent" }], runId),
    )
    expect(closed.answer).toMatchObject({ ok: false, refusal: "person-protected", refused: "person", node: added[0] })
    const reopened = await by.call("edit_deck", edit(deck, rev + 2, [{ op: "set", target: added[0], name: "Agent" }]))
    expect(reopened.ok).toBe(true)
  })
})

describe("stop_run", () => {
  it("stops the run, so the next edit in it is refused run-fenced", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call(
      "edit_deck",
      edit(deck, rev, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]),
    )
    const { runId } = first.answer as { runId: string }
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.answer).toMatchObject({ ok: true, runId, rev: rev + 2 })
    const fenced = await by.call(
      "edit_deck",
      edit(deck, rev + 2, [{ op: "add", kind: "text", slide: slides[0], text: "B" }], runId),
    )
    expect(fenced.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
  })

  it("answers a second stop ok and lands nothing", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call(
      "edit_deck",
      edit(deck, rev, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]),
    )
    const { runId } = first.answer as { runId: string }
    await by.call("stop_run", { deck, runId })
    const again = await by.call("stop_run", { deck, runId })
    expect(again.answer).toMatchObject({ ok: true, runId, rev: rev + 2 })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 2)
  })

  it("refuses a run the deck never held", async () => {
    const by = agent()
    const { deck } = await created(by)
    expect((await by.call("stop_run", { deck, runId: "nothing" })).answer).toMatchObject({
      ok: false,
      refusal: "run-fenced",
    })
  })
})
