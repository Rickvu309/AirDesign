import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session, type Answer } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks, type MemoryDecks } from "./testing/memory-decks.js"
import { offTheme } from "./testing/suite-art.js"
import { testTheme } from "@airdesign/doom/testing"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function start(): doom.Doom {
  return doom.doomFromTree({
    theme: testTheme,
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
  const session: Session = { agent: id, mint: () => `minted${String((minted += 1))}` }
  let calls = 0
  return {
    decks,
    call: async (op: string, args: unknown, once?: string): Promise<Answer> => {
      session.once = once ?? `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

async function created(by: ReturnType<typeof agent>) {
  const made = await by.call("execute", { script: "createDeck()" })
  return made.fields as { deck: string; rev: number; slides: string[] }
}

const edit = (deck: string, changes: unknown[], runId?: string) => ({
  deck,
  script: scriptOf(changes),
  ...(runId === undefined ? {} : { runId }),
})

async function read(by: ReturnType<typeof agent>, deck: string, fields: Readonly<Record<string, unknown>> = {}) {
  const got = await by.call("execute", { deck, script: `get(${JSON.stringify(fields)})` })
  return got.ok ? { ...got, fields: got.fields.result as Record<string, unknown> } : got
}

const person: doom.Author = { kind: "person", id: "quan" }

describe("createDeck and get_app_state", () => {
  it("makes a deck and answers its id, name and first read", async () => {
    const by = agent()
    const made = await by.call("execute", { script: 'createDeck({ name: "Board" })' })
    expect(made.ok).toBe(true)
    expect(made.fields).toMatchObject({
      ok: true,
      rev: expect.any(Number),
      name: "Board",
      slides: [expect.any(String)],
    })
    expect(made.fields.layers).toContain('text="Untitled"')
    expect(by.decks.decks.size).toBe(1)
  })

  it("makes one deck for a call sent again with the same once", async () => {
    const by = agent()
    const first = await by.call("execute", { script: "createDeck()" }, "same")
    const again = await by.call("execute", { script: "createDeck()" }, "same")
    expect(again.fields).toEqual(first.fields)
    expect(by.decks.decks.size).toBe(1)
  })

  it("lists the decks with id, name and rev", async () => {
    const by = agent()
    const made = await created(by)
    const listed = await by.call("get_app_state", {})
    expect(listed.fields).toEqual({
      ok: true,
      decks: [{ deck: made.deck, name: "Blank deck", rev: made.rev }],
      openDeck: null,
      note: "No deck is open in an AirDesign tab.",
    })
  })

  it("refuses a field it does not take", async () => {
    const by = agent()
    expect((await by.call("execute", { script: 'createDeck({ template: "neutral" })' })).fields).toMatchObject({
      ok: false,
      refusal: "field",
    })
    expect((await by.call("get_app_state", { deck: "x" })).fields).toMatchObject({ ok: false, refusal: "field" })
  })
})

describe("get in execute", () => {
  it("prints a line for each layer and the deck's rev", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const got = await read(by, deck)
    expect(got.fields).toMatchObject({ kind: "deck", deck, rev, slides })
    const lines = String(got.fields.layers).split("\n")
    expect(lines[0]).toMatch(/^slide /)
    expect(lines[1]).toMatch(/^ {2}\S+ text:title @160,380 1600x160 .*text="Untitled"/)
  })

  it("reads one slide, and refuses a slide the deck does not have", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const one = await read(by, deck, { target: slides[0] })
    expect(one.ok).toBe(true)
    const none = await read(by, deck, { target: "z:9" })
    expect(none.fields).toMatchObject({ ok: false, refusal: "dead", node: "z:9" })
  })

  it("pages a long deck by slide with next, and the next page continues from it", async () => {
    const by = agent()
    const { deck } = await created(by)
    const words = "word ".repeat(1_200).trim()
    await by.call(
      "execute",
      edit(
        deck,
        Array.from({ length: 12 }, () => ({ op: "insert", kind: "slide" })),
      ),
    )
    const slides = (await read(by, deck)).fields.slides as string[]
    const filled = await by.call(
      "execute",
      edit(
        deck,
        slides.map((slide) => ({
          op: "insert",
          kind: "text",
          parent: slide,
          text: words,
          box: { x: 0, y: 0, w: 1920, h: 900 },
        })),
      ),
    )
    expect(filled.ok).toBe(true)
    const first = await read(by, deck)
    const next = (first.fields as { next?: string }).next
    expect(next).toBeDefined()
    const rest = await read(by, deck, { cursor: next })
    expect(String(rest.fields.layers).split("\n")[0]).toContain(next)
    expect(String(first.fields.layers)).not.toContain(`slide ${next}`)
  })

  it("refuses an unknown deck", async () => {
    const by = agent()
    expect((await read(by, "nothere")).fields).toMatchObject({ ok: false, refusal: "deck" })
  })
})

describe("changes in execute", () => {
  it("starts a run, lands the changes at the next rev and answers the id the script returned", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "Hello **there**", textStyle: "heading" }]),
    )
    expect(landed.fields).toMatchObject({
      ok: true,
      deck,
      rev: rev + 1,
      runId: expect.any(String),
      result: expect.stringMatching(/^m\w+:1$/),
    })
    const fold = by.decks.decks.get(deck as never)!
    expect(fold.runs.get((landed.fields as { runId: string }).runId)?.phase).toBe("running")
    expect(String((await read(by, deck)).fields.layers)).toContain('text="Hello **there**"')
  })

  it("lands a hex colour and names the nearest theme colour in the answer's JSON, and finds nothing on names", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [{ op: "update", target: `${slides[0]!}.title`, text: "Sales grew", color: offTheme }]),
    )
    const answer = landed.fields as { note: string; problems: { code: string; note: string }[] }
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
        [{ op: "update", target: `${slides[0]!}.title`, color: "accent1" }],
        (landed.fields as { runId: string }).runId,
      ),
    )
    expect(plain.fields.problems).toEqual([])
  })

  it("answers only the root of what a grid add created", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const landed = await by.call(
      "execute",
      edit(deck, [
        {
          op: "insert",
          kind: "frame",
          parent: slides[0],
          rows: [
            ["Revenue", "$4M"],
            ["Margin", "31%"],
          ],
        },
      ]),
    )
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.layerKind(fold.nodes.get(landed.fields.result as never)!)).toBe("frame")
    expect(fold.nodes.size).toBeGreaterThan(8)
  })

  it("lands a second call in the same run, and a call with no runId in a new one", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "A" }]))
    const { runId } = first.fields as { runId: string }
    const second = await by.call(
      "execute",
      edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "B" }], runId),
    )
    expect(second.fields).toMatchObject({ ok: true, rev: rev + 2, runId })
    const third = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "C" }]))
    expect((third.fields as { runId: string }).runId).not.toBe(runId)
  })

  it("lands nothing and answers unchanged for a call that sets only values the deck already holds", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const set = [{ op: "update", target: `${slides[0]!}.title`, text: "Same" }]
    const first = await by.call("execute", edit(deck, set))
    const { runId } = first.fields as { runId: string }
    const runs = by.decks.decks.get(deck as never)!.runs.size
    const again = await by.call("execute", edit(deck, set, runId))
    expect(again.fields).toMatchObject({ ok: true, unchanged: true, rev: rev + 1, runId })
    const fresh = await by.call("execute", edit(deck, set))
    expect(fresh.fields).toMatchObject({ ok: true, unchanged: true, rev: rev + 1 })
    expect(fresh.fields).not.toHaveProperty("runId")
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
        { op: "insert", kind: "text", parent: slides[0], text: "A" },
        { op: "update", target: "z:9", text: "B" },
      ]),
    )
    expect(refused.ok).toBe(false)
    expect(refused.fields).toMatchObject({
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
    expect(String(refused.fields.note)).toContain("Operation 2 (update) at line 2")
  })

  it("names the operation that has a field its kind does not take", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const refused = await by.call(
      "execute",
      edit(deck, [
        { op: "insert", kind: "text", parent: slides[0], text: "A" },
        { op: "insert", kind: "line", parent: slides[0], text: "no" },
      ]),
    )
    expect(refused.fields).toMatchObject({ ok: false, refusal: "field", refused: "shape", op: 2, field: "text" })
  })

  it("names the operation whose form cannot be read", async () => {
    const by = agent()
    const { deck } = await created(by)
    const refused = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: "bad id" }]))
    expect(refused.fields).toMatchObject({ ok: false, refusal: "field", op: 1, field: "parent", fault: "form" })
  })

  it("refuses a call over 100 changes at the operation that passes it, an empty script and an unknown field", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const change = { op: "insert", kind: "text", parent: slides[0], text: "A", box: { x: 0, y: 0, w: 100, h: 50 } }
    const many = await by.call(
      "execute",
      edit(
        deck,
        Array.from({ length: 101 }, () => change),
      ),
    )
    expect(many.fields).toMatchObject({ ok: false, refusal: "limit", op: 101 })
    expect(String(many.fields.note)).toContain("at most 100 changes")
    expect((await by.call("execute", { deck, script: "" })).fields).toMatchObject({ ok: false, refusal: "field" })
    expect((await by.call("execute", { ...edit(deck, [change]), actor: "person" })).fields).toMatchObject({
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
      { op: "update", target: `${slides[0]}.title`, text: "A" },
      { op: "insert", kind: "shape", parent: slides[0], box: { x: 0, y: 0, w: 10, h: 10 } },
      { op: "insert", kind: "slide" },
    ])
    const first = await by.call("execute", args, "again")
    const again = await by.call("execute", args, "again")
    expect(again.fields).toMatchObject({ ok: true, rev: first.fields.rev, runId: first.fields.runId })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 1)
  })

  it("refuses a slide add that names a layout, since a deck has none to list", async () => {
    const by = agent()
    const { deck } = await created(by)
    const refused = await by.call("execute", edit(deck, [{ op: "insert", kind: "slide", layout: "Blank" }]))
    expect(refused.fields).toMatchObject({ ok: false, refusal: "field" })
  })

  it("closes a layer to the run once a person changes it, and opens it again in a new run", async () => {
    const by = agent()
    const { deck, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "A" }]))
    const { runId, result: added } = first.fields as { runId: string; result: string }
    await by.decks.edit(deck as never, {
      once: "typed",
      author: person,
      writes: [{ node: added as never, prop: "name", value: "Mine" }],
    })
    const closed = await by.call("execute", edit(deck, [{ op: "update", target: added, name: "Agent" }], runId))
    expect(closed.fields).toMatchObject({ ok: false, refusal: "person-protected", refused: "person", node: added })
    const reopened = await by.call("execute", edit(deck, [{ op: "update", target: added, name: "Agent" }]))
    expect(reopened.ok).toBe(true)
  })
})

describe("stop_run", () => {
  it("stops the run, so the next call in it is refused run-fenced", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "A" }]))
    const { runId } = first.fields as { runId: string }
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.fields).toMatchObject({ ok: true, runId, rev: rev + 2 })
    const fenced = await by.call(
      "execute",
      edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "B" }], runId),
    )
    expect(fenced.fields).toMatchObject({ ok: false, refusal: "run-fenced" })
  })

  it("answers a second stop ok and lands nothing", async () => {
    const by = agent()
    const { deck, rev, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "A" }]))
    const { runId } = first.fields as { runId: string }
    await by.call("stop_run", { deck, runId })
    const again = await by.call("stop_run", { deck, runId })
    expect(again.fields).toMatchObject({ ok: true, runId, rev: rev + 2 })
    expect(by.decks.decks.get(deck as never)!.rev).toBe(rev + 2)
  })

  it("refuses another agent's run, which keeps running and taking its agent's edits", async () => {
    const by = agent()
    const other = agent(by.decks, "claude")
    const { deck, slides } = await created(by)
    const first = await by.call("execute", edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "A" }]))
    const { runId } = first.fields as { runId: string }
    expect((await other.call("stop_run", { deck, runId }, "other-stop")).fields).toMatchObject({
      ok: false,
      refusal: "run-fenced",
    })
    const intruded = await other.call(
      "execute",
      edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "B" }], runId),
      "other-edit",
    )
    expect(intruded.fields).toMatchObject({ ok: false, refusal: "run-fenced" })
    const more = await by.call(
      "execute",
      edit(deck, [{ op: "insert", kind: "text", parent: slides[0], text: "C" }], runId),
    )
    expect(more.ok).toBe(true)
  })

  it("refuses a run the deck never held", async () => {
    const by = agent()
    const { deck } = await created(by)
    expect((await by.call("stop_run", { deck, runId: "nothing" })).fields).toMatchObject({
      ok: false,
      refusal: "run-fenced",
    })
  })
})
