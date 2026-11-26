import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session, type ToolResult } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks, type MemoryDecks } from "./testing/memory-decks.js"
import { offTheme } from "./testing/suite-art.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function start(): doom.Doom {
  return doom.doomFromTree({
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

const edit = (deck: string, changes: unknown[], runId?: string) => ({
  deck,
  script: scriptOf(changes),
  ...(runId === undefined ? {} : { runId }),
})

async function read(by: ReturnType<typeof agent>, deck: string, fields: Readonly<Record<string, unknown>> = {}) {
  const got = await by.call("execute", { deck, script: `get(${JSON.stringify(fields)})` })
  return got.ok ? { ...got, answer: got.answer.result as Record<string, unknown> } : got
}

const person: doom.Author = { kind: "person", id: "quan" }

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
    expect(made.answer.layers).toContain('text="Untitled"')
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
    expect(listed.answer).toEqual({
      ok: true,
      decks: [{ deck: made.deck, name: "Blank deck", rev: made.rev }],
      note: "Your decks.",
    })
  })

  it("refuses a field it does not take", async () => {
    const by = agent()
    expect((await by.call("create_deck", { template: "neutral" })).answer).toMatchObject({
      ok: false,
      refusal: "field",
    })
    expect((await by.call("list_decks", { deck: "x" })).answer).toMatchObject({ ok: false, refusal: "field" })
  })
})

describe("get in execute", () => {
  it("prints a line for each layer and the deck's rev", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const got = await read(by, deck)
    expect(got.answer).toMatchObject({ kind: "deck", deck, rev, slides })
    const lines = String(got.answer.layers).split("\n")
    expect(lines[0]).toMatch(/^slide /)
    expect(lines[1]).toMatch(/^ {2}\S+ text:title @160,380 1600x160 .*text="Untitled"/)
  })

  it("reads one slide, and refuses a slide the deck does not have", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const one = await read(by, deck, { target: slides[0] })
    expect(one.ok).toBe(true)
    const none = await read(by, deck, { target: "z:9" })
    expect(none.answer).toMatchObject({ ok: false, refusal: "dead", node: "z:9" })
  })

  it("pages a long deck by slide with next, and the next page continues from it", async () => {
    const by = agent()
    const { deck } = await created(by)
    const words = "word ".repeat(1_200).trim()
    await by.call(
      "execute",
      edit(
        deck,
        Array.from({ length: 12 }, () => ({ op: "slide", add: {} })),
      ),
    )
    const slides = (await read(by, deck)).answer.slides as string[]
    const filled = await by.call(
      "execute",
      edit(
        deck,
        slides.map((slide) => ({ op: "add", kind: "text", slide, text: words, box: { x: 0, y: 0, w: 1920, h: 900 } })),
      ),
    )
    expect(filled.ok).toBe(true)
    const first = await read(by, deck)
    const next = (first.answer as { next?: string }).next
    expect(next).toBeDefined()
    const rest = await read(by, deck, { cursor: next })
    expect(String(rest.answer.layers).split("\n")[0]).toContain(next)
    expect(String(first.answer.layers)).not.toContain(`slide ${next}`)
  })

  it("refuses an unknown deck", async () => {
    const by = agent()
    expect((await read(by, "nothere")).answer).toMatchObject({ ok: false, refusal: "deck" })
  })
})

describe("changes in execute", () => {
  it("starts a run, lands the changes at the next rev and answers the ids it added", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "Hello **there**", textStyle: "heading" }]),
    )
    expect(landed.answer).toMatchObject({
      ok: true,
      deck,
      rev: rev + 1,
      runId: expect.any(String),
      made: [{ op: 1, verb: "insert", ids: [expect.stringMatching(/^m\w+:1$/)] }],
    })
    const fold = by.decks.decks.get(deck as never)!
    expect(fold.runs.get((landed.answer as { runId: string }).runId)?.phase).toBe("running")
    expect(String((await read(by, deck)).answer.layers)).toContain('text="Hello **there**"')
  })

  it("lands a hex colour and names the nearest theme colour in the answer's JSON, and finds nothing on names", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [{ op: "set", target: `${slides[0]!}.title`, text: "Sales grew", color: offTheme }]),
    )
    const answer = landed.answer as { note: string; problems: { code: string; note: string }[] }
    expect(landed.ok).toBe(true)
    expect(answer.note).toContain("fix it unless the person asked for it")
    expect(answer.problems).toMatchObject([{ code: "off-palette", color: offTheme, to: expect.any(String) }])
    expect(answer.problems[0]!.note).toContain(
      `${offTheme} is not a theme colour, so a new template will not recolour it`,
    )
    const plain = await by.call(
      "execute",
      edit(
        deck,
        [{ op: "set", target: `${slides[0]!}.title`, color: "accent1" }],
        (landed.answer as { runId: string }).runId,
      ),
    )
    expect(plain.answer.problems).toEqual([])
  })

  it("answers only the root of what a grid add created", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [
        {
          op: "add",
          kind: "frame",
          slide: slides[0],
          rows: [
            ["Revenue", "$4M"],
            ["Margin", "31%"],
          ],
        },
      ]),
    )
    const [made] = (landed.answer as { made: { ids: string[] }[] }).made
    expect(made!.ids).toHaveLength(1)
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.agentKind(fold.nodes.get(made!.ids[0] as never)!)).toBe("frame")
    expect(fold.nodes.size).toBeGreaterThan(8)
  })

  it("lands a second call in the same run, and a call with no runId in a new one", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]))
    const { runId } = first.answer as { runId: string }
    const second = await by.call(
      "execute",
      edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "B" }], runId),
    )
    expect(second.answer).toMatchObject({ ok: true, rev: rev + 2, runId })
    const third = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "C" }]))
    expect((third.answer as { runId: string }).runId).not.toBe(runId)
  })

  it("lands nothing and answers unchanged for a call that sets only values the deck already holds", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const set = [{ op: "set", target: `${slides[0]!}.title`, text: "Same" }]
    const first = await by.call("execute", edit(deck, set))
    const { runId } = first.answer as { runId: string }
    const runs = by.decks.decks.get(deck as never)!.runs.size
    const again = await by.call("execute", edit(deck, set, runId))
    expect(again.answer).toMatchObject({ ok: true, unchanged: true, rev: rev + 1, runId })
    const fresh = await by.call("execute", edit(deck, set))
    expect(fresh.answer).toMatchObject({ ok: true, unchanged: true, rev: rev + 1 })
    expect(fresh.answer).not.toHaveProperty("runId")
    const fold = by.decks.decks.get(deck as never)!
    expect(fold.rev).toBe(rev + 1)
    expect(fold.runs.size).toBe(runs)
  })

  it("lands none of a call when one operation is refused, and names the operation, its line and the field", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const refused = await by.call(
      "execute",
      edit(deck, [
        { op: "add", kind: "text", slide: slides[0], text: "A" },
        { op: "set", target: "z:9", text: "B" },
      ]),
    )
    expect(refused.ok).toBe(false)
    expect(refused.answer).toMatchObject({
      ok: false,
      refusal: "dead",
      refused: "missing",
      op: 2,
      verb: "update",
      line: 2,
      field: "target",
      node: "z:9",
    })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev)
    expect(String(refused.answer.note)).toContain("Operation 2 (update) at line 2")
  })

  it("names the operation that has a field its kind does not take", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const refused = await by.call(
      "execute",
      edit(deck, [
        { op: "add", kind: "text", slide: slides[0], text: "A" },
        { op: "add", kind: "line", slide: slides[0], text: "no" },
      ]),
    )
    expect(refused.answer).toMatchObject({ ok: false, refusal: "field", refused: "shape", op: 2, field: "text" })
  })

  it("names the operation whose form cannot be read", async () => {
    const by = agent()
    const { deck } = await created(by)
    const refused = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: "bad id" }]))
    expect(refused.answer).toMatchObject({ ok: false, refusal: "dead", op: 1, field: "parent" })
  })

  it("refuses a call over 100 changes at the operation that passes it, an empty script and an unknown field", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const change = { op: "add", kind: "text", slide: slides[0], text: "A", box: { x: 0, y: 0, w: 100, h: 50 } }
    const many = await by.call(
      "execute",
      edit(
        deck,
        Array.from({ length: 101 }, () => change),
      ),
    )
    expect(many.answer).toMatchObject({ ok: false, refusal: "limit", op: 101 })
    expect(String(many.answer.note)).toContain("at most 100 changes")
    expect((await by.call("execute", { deck, script: "" })).answer).toMatchObject({ ok: false, refusal: "field" })
    expect((await by.call("execute", { ...edit(deck, [change]), actor: "person" })).answer).toMatchObject({
      ok: false,
      refusal: "field",
      field: "actor",
    })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev)
  })

  it("answers a call sent again with the same once with what it landed, and lands it once", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const args = edit(deck, [
      { op: "set", target: `${slides[0]}.title`, text: "A" },
      { op: "add", kind: "shape", slide: slides[0], box: { x: 0, y: 0, w: 10, h: 10 } },
      { op: "slide", add: {} },
    ])
    const first = await by.call("execute", args, "again")
    expect(first.answer.made).toEqual([
      { op: 2, verb: "insert", ids: [expect.any(String)] },
      { op: 3, verb: "insert", ids: [expect.any(String)] },
    ])
    const again = await by.call("execute", args, "again")
    expect(again.answer).toMatchObject({ ok: true, rev: first.answer.rev, runId: first.answer.runId })
    expect((again.answer.made as { ids: string[] }[]).flatMap((each) => each.ids).sort()).toEqual(
      (first.answer.made as { ids: string[] }[]).flatMap((each) => each.ids).sort(),
    )
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 1)
  })

  it("refuses a slide add that names a layout, since a deck has none to list", async () => {
    const by = agent()
    const { deck } = await created(by)
    const refused = await by.call("execute", edit(deck, [{ op: "slide", add: { layout: "Blank" } }]))
    expect(refused.answer).toMatchObject({ ok: false, refusal: "field" })
  })

  it("closes a layer to the run once a person changes it, and opens it again in a new run", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]))
    const { runId, made } = first.answer as { runId: string; made: { ids: string[] }[] }
    const added = made.flatMap((each) => each.ids)
    await by.decks.edit(deck as never, {
      once: "typed",
      author: person,
      writes: [{ node: added[0] as never, prop: "name", value: "Mine" }],
    })
    const closed = await by.call("execute", edit(deck, [{ op: "set", target: added[0], name: "Agent" }], runId))
    expect(closed.answer).toMatchObject({ ok: false, refusal: "person-protected", refused: "person", node: added[0] })
    const reopened = await by.call("execute", edit(deck, [{ op: "set", target: added[0], name: "Agent" }]))
    expect(reopened.ok).toBe(true)
  })
})

describe("stop_run", () => {
  it("stops the run, so the next call in it is refused run-fenced", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]))
    const { runId } = first.answer as { runId: string }
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.answer).toMatchObject({ ok: true, runId, rev: rev + 2 })
    const fenced = await by.call(
      "execute",
      edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "B" }], runId),
    )
    expect(fenced.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
  })

  it("answers a second stop ok and lands nothing", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]))
    const { runId } = first.answer as { runId: string }
    await by.call("stop_run", { deck, runId })
    const again = await by.call("stop_run", { deck, runId })
    expect(again.answer).toMatchObject({ ok: true, runId, rev: rev + 2 })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 2)
  })

  it("refuses another agent's run, which keeps running and taking its agent's edits", async () => {
    const by = agent()
    const other = agent(by.decks, "claude")
    const { deck, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "A" }]))
    const { runId } = first.answer as { runId: string }
    expect((await other.call("stop_run", { deck, runId }, "other-stop")).answer).toMatchObject({
      ok: false,
      refusal: "run-fenced",
    })
    const intruded = await other.call(
      "execute",
      edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "B" }], runId),
      "other-edit",
    )
    expect(intruded.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
    const more = await by.call("execute", edit(deck, [{ op: "add", kind: "text", slide: slides[0], text: "C" }], runId))
    expect(more.ok).toBe(true)
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
