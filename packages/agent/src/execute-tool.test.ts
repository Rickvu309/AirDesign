import { readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Answer = Record<string, any>

function agent(more: Partial<DeckHost> = {}) {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }), ...more }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (name: string, args: unknown, once?: string) => {
    session.once = once ?? `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ...result, fields: result.fields as Answer }
  }
  const made = async () =>
    (await call("execute", { script: "createDeck()" })).fields as { deck: string; slides: string[] }
  const fold = (deck: string) => decks.decks.get(deck as never)!
  const live = (deck: string) =>
    new Set([
      ...doom.slidesOf(fold(deck)).map((slide) => slide.id as string),
      ...[...fold(deck).nodes.values()].filter((node) => doom.parentOf(node) != null).map((node) => node.id as string),
    ])
  return { decks, call, made, fold, live }
}

describe("execute runs a script as one edit", () => {
  it("lands a 30-operation script as one edit that undo takes back in one step", async () => {
    const by = agent()
    const { deck } = await by.made()
    const before = by.fold(deck)
    const answer = await by.call("execute", {
      deck,
      script: `
        const s = insert({ kind: "slide" })
        insert({ parent: s, kind: "text", textStyle: "title", text: "Thirty operations" })
        for (let i = 0; i < 28; i++)
          insert({ parent: s, kind: "shape", shape: "rect", fill: "accent1", box: { x: 60 + (i % 7) * 260, y: 260 + Math.floor(i / 7) * 180, w: 220, h: 140 } })
        s
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(answer.fields).not.toHaveProperty("made")
    expect(answer.fields.rev).toBe(before.rev + 1)
    const slide = answer.fields.result as string
    expect(doom.childrenOf(by.fold(deck), slide as doom.NodeId)).toHaveLength(29)
    const undone = await by.call("undo_run", { deck, runId: answer.fields.runId })
    expect(undone.ok, JSON.stringify(undone.fields)).toBe(true)
    expect(doom.slidesOf(by.fold(deck)).map((each) => each.id)).toEqual(doom.slidesOf(before).map((each) => each.id))
    expect(by.live(deck).has(slide)).toBe(false)
  })

  it("adds slides and fills them from a loop, and every id the script saw is in the landed deck", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `
        const ids = []
        for (const word of ["One", "Two", "Three"]) {
          const s = insert({ kind: "slide" })
          insert({ parent: s, kind: "text", textStyle: "title", text: word })
          const card = insert({ parent: s, kind: "frame", layout: "column", gap: 16, box: { x: 120, y: 300, w: 520, h: 400 }, name: word + " card" })
          insert({ parent: card, kind: "text", text: word + " body" })
          const flat = insert({ parent: s, kind: "frame", layout: "column", box: { x: 800, y: 300, w: 520, h: 400 } })
          insert({ parent: flat, kind: "text", text: "Baked" })
          update({ target: flat, layout: "none" })
          const [copied] = copy({ targets: [card] })
          const swapped = replace({ target: copied, kind: "text", text: "In its place" })
          update({ target: s + ".title", text: word + " title" })
          ids.push(s, card, flat, swapped, get({ target: card }).children[0])
        }
        ids
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const live = by.live(deck)
    for (const id of answer.fields.result as string[]) expect(live.has(id), id).toBe(true)
    expect(Object.keys(answer.fields.names)).toEqual(["One card", "Two card", "Three card"])
    expect(answer.fields.bakedLayouts).toHaveLength(3)
  })

  it("refuses the whole call when an operation is refused, naming it by number, verb and line", async () => {
    const by = agent()
    const { deck } = await by.made()
    const before = by.fold(deck).rev
    const answer = await by.call("execute", {
      deck,
      script: `const s = insert({ kind: "slide" })\ninsert({ parent: s, kind: "text", text: "fine" })\ninsert({ parent: s, kind: "text", fill: "accent9" })`,
    })
    expect(answer.ok).toBe(false)
    expect(answer.fields).toMatchObject({ refusal: "field", op: 3, verb: "insert", line: 3 })
    expect(String(answer.fields.note)).toMatch(/^Nothing landed\. Operation 3 \(insert\) at line 3: /)
    expect(by.fold(deck).rev).toBe(before)
  })

  it("lets a script catch a refusal and go on, and that operation changes nothing", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `const s = insert({ kind: "slide" }); try { insert({ parent: "nope:1", kind: "text" }) } catch (e) { print(e.message) }; s`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(answer.fields.logs).toEqual([expect.stringMatching(/^Operation 2 \(insert\): /)])
    expect(by.live(deck).has(answer.fields.result)).toBe(true)
  })

  it("names a thrown error and its line when the script itself fails, and lands nothing", async () => {
    const by = agent()
    const { deck } = await by.made()
    const before = by.fold(deck).rev
    const answer = await by.call("execute", { deck, script: `insert({ kind: "slide" })\n\nnotAFunction()` })
    expect(answer.fields).toMatchObject({ ok: false, refusal: "script", line: 3 })
    expect(String(answer.fields.note)).toContain("ReferenceError")
    expect(by.fold(deck).rev).toBe(before)
  })

  it("refuses a script over 100,000 characters before it runs", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", { deck, script: `// ${"x".repeat(100_000)}` })
    expect(answer.fields).toMatchObject({ ok: false, refusal: "field", field: "script", fault: "form" })
  })

  it("answers a read-only script without landing or starting a run", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const before = by.fold(deck).rev
    const answer = await by.call("execute", {
      deck,
      script: `const d = get(); const s = get({ target: d.slides[0] }); [d.kind, d.slides.length, s.kind, typeof s.layers]`,
    })
    expect(answer.fields).toMatchObject({ ok: true, rev: before, result: ["deck", slides.length, "slide", "string"] })
    expect(answer.fields.runId).toBeUndefined()
    expect(answer.fields).not.toHaveProperty("slide")
    expect(String(answer.fields.note)).toContain("only read the deck")
  })

  it("answers with the slide an edit landed on", async () => {
    const by = agent()
    const { deck } = await by.made()
    const added = await by.call("execute", { deck, script: 'insert({ kind: "slide" })' })
    const second = added.fields.result
    expect(added.fields).toMatchObject({ ok: true, slide: second })
    const answer = await by.call("execute", {
      deck,
      script: `insert({ parent: "${second}", kind: "text", text: "Second" })`,
    })
    expect(answer.fields).toMatchObject({ ok: true, slide: second })
  })

  it("answers with the last changed slide in script order", async () => {
    const by = agent()
    const {
      deck,
      slides: [first],
    } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `
        const second = insert({ kind: "slide", name: "Second" })
        insert({ parent: "${first}", kind: "text", text: "Last edit" })
        update({ target: second, name: "Second" })
        get({ target: second })
      `,
    })
    expect(answer.fields).toMatchObject({ ok: true, slide: first })
  })

  it("omits the slide when its value already matches", async () => {
    const by = agent()
    const { deck } = await by.made()
    const added = await by.call("execute", { deck, script: 'insert({ kind: "slide", name: "Second" })' })
    const answer = await by.call("execute", {
      deck,
      script: `update({ target: "${added.fields.result}", name: "Second" })`,
    })
    expect(answer.fields).toMatchObject({ ok: true, unchanged: true })
    expect(answer.fields).not.toHaveProperty("slide")
  })

  it("falls back to the last surviving edited slide after deleting a slide", async () => {
    const by = agent()
    const {
      deck,
      slides: [first],
    } = await by.made()
    const added = await by.call("execute", { deck, script: 'insert({ kind: "slide" })' })
    const deleted = await by.call("execute", {
      deck,
      script: `remove({ target: "${added.fields.result}" })`,
    })
    expect(deleted.ok).toBe(true)
    expect(deleted.fields).not.toHaveProperty("slide")
    const answer = await by.call("execute", {
      deck,
      script: `
        update({ target: "${first}", name: "Kept" })
        const second = insert({ kind: "slide" })
        remove({ target: second })
      `,
    })
    expect(answer.fields).toMatchObject({ ok: true, slide: first })
  })

  it("answers the same call again with what it landed, without running the script twice", async () => {
    const by = agent()
    const { deck } = await by.made()
    const script = `insert({ kind: "slide" })`
    const first = await by.call("execute", { deck, script }, "same-call")
    const again = await by.call("execute", { deck, script }, "same-call")
    expect(again.fields).toMatchObject({ ok: true, rev: first.fields.rev, runId: first.fields.runId })
    expect(String(again.fields.note)).toContain("landed before")
    expect(doom.slidesOf(by.fold(deck))).toHaveLength(2)
  })

  it("keeps the person's text when an agent writes from an earlier read, then lands after a new read", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const first = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]}", kind: "text", text: "Original" })`,
    })
    const lead = first.fields.result as doom.NodeId
    const read = { deck, script: `get({ target: "${lead}" })` }
    const write = { deck, script: `update({ target: "${lead}", text: "Agent's revision" })` }
    expect((await by.call("execute", read)).fields.result.layers).toContain("Original")
    const named = readDeckId(deck)
    if (!named.ok) throw new Error("invalid deck")
    const fold = by.fold(deck)
    const typed = await by.decks.edit(named.deck, {
      once: "person-types",
      author: { kind: "person", id: "quan" },
      writes: [{ node: lead, prop: "text", value: doom.textFromMarkdown("Person's revision", "body"), base: fold.rev }],
    })
    expect(typed.ok).toBe(true)

    const refused = await by.call("execute", write)
    expect(refused.fields).toMatchObject({ ok: false, refusal: "stale", node: lead, prop: "text" })
    expect(String(refused.fields.note)).toContain("Read")
    expect(by.fold(deck).rev).toBe(typed.ok ? typed.rev : undefined)
    expect(doom.propOf(by.fold(deck).nodes.get(lead), "text")?.chars).toBe("Person's revision")

    const unrelated = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]}", kind: "shape", shape: "rect" })`,
    })
    expect(unrelated.ok).toBe(true)
    expect((await by.call("execute", write)).fields).toMatchObject({ ok: false, refusal: "stale" })

    expect((await by.call("execute", read)).fields.result.layers).toContain("Person's revision")
    expect((await by.call("execute", write)).ok).toBe(true)
    expect(doom.propOf(by.fold(deck).nodes.get(lead), "text")?.chars).toBe("Agent's revision")
  })

  it("refuses the call as stale when a person changes the same text while the script runs", async () => {
    let racing = false
    const by = agent({
      edit: async (deck, sent) => {
        if (racing) {
          racing = false
          const fold = by.fold(deck)
          const text = doom.propOf(fold.nodes.get(lead), "text")!
          const base = fold.revs.get(lead)?.get("text")
          const typed = await by.decks.edit(deck, {
            once: "person-types",
            author: { kind: "person", id: "quan" },
            writes: [
              { node: lead, prop: "text", value: { ...text, chars: "Fifth" }, ...(base === undefined ? {} : { base }) },
            ],
          })
          expect(typed.ok, JSON.stringify(typed)).toBe(true)
        }
        return by.decks.edit(deck, sent)
      },
    })
    const { deck, slides } = await by.made()
    const first = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]}", kind: "text", text: "First" })`,
    })
    const lead = first.fields.result as doom.NodeId
    racing = true
    const answer = await by.call("execute", { deck, script: `update({ target: "${lead}", text: "Second" })` })
    expect(answer.fields, JSON.stringify(answer.fields)).toMatchObject({ ok: false, refusal: "stale" })
    expect(String(answer.fields.note)).toContain("The deck changed while the call ran")
    expect(doom.propOf(by.fold(deck).nodes.get(lead), "text")?.chars).toBe("Fifth")
  })
})

describe("what get reads inside a script", () => {
  it("measures a layer with the host's fonts and lists the problems inside it", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `
        const s = insert({ kind: "slide" })
        const card = insert({ parent: s, kind: "frame", layout: "column", box: { x: 1700, y: 900, w: 400, h: 300 } })
        insert({ parent: card, kind: "text", text: "Spills past the edge" })
        const read = get({ target: card })
        ;[read.kind, read.box, read.children.length, read.problems.map((p) => p.code)]
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(answer.fields.result).toEqual(["frame", { x: 1700, y: 900, w: 400, h: 300 }, 1, ["off-slide"]])
  })

  it("finds layers by their words", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]!}", kind: "text", text: "Revenue grew" }); get({ find: "revenue" }).found`,
    })
    expect(answer.fields.result).toBe(1)
  })
})

describe("screenshots in an execute answer", () => {
  it("says at once that no tab is open when none watches the deck", async () => {
    const by = agent({ screenshots: async () => "no painter" })
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", { deck, script: `screenshot({ target: "${slides[0]!}" })` })
    expect(answer.ok).toBe(true)
    expect(String(answer.fields.note)).toContain("none is open")
    expect(answer.screenshots).toEqual([])
  })

  it("adds the open tab's screenshot of each slide asked for, once for the call", async () => {
    let asked = 0
    const by = agent({
      screenshots: async (_deck, _fold, slides) => {
        asked += 1
        return new Map(slides.map((slide) => [slide, "QUFB"]))
      },
    })
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `const s = insert({ kind: "slide" }); screenshot({ target: s }); screenshot({ target: "${slides[0]!}" }); screenshot({ target: s })`,
    })
    expect(asked).toBe(1)
    expect(answer.fields.screenshots).toHaveLength(2)
    expect(answer.fields).not.toHaveProperty("slide")
    expect(answer.screenshots).toEqual(["QUFB", "QUFB"])
  })
})

describe("refusal notes in the operation's own words", () => {
  it("says a frame takes no text style and where it goes instead", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `const s = insert({ kind: "slide" })\nconst f = insert({ parent: s, kind: "frame", layout: "column" })\nupdate({ target: f, textStyle: "title" })`,
    })
    expect(String(answer.fields.note)).toMatch(
      /Operation 3 \(update\) at line 3: .* is a frame, which takes no textStyle\. Set it on the text layers inside/,
    )
  })

  it("lists the operation's own fields for one it does not take", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]!}", kind: "text", slide: "x" })`,
    })
    const note = String(answer.fields.note)
    expect(note).toContain("insert takes no slide. Its fields: parent, kind,")
    expect(note).not.toMatch(/\binto\b|component|tokens/)
  })

  it("lists only the fields a line takes when it is given text", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `insert({ parent: "${slides[0]!}", kind: "line", text: "Go" })`,
    })
    const note = String(answer.fields.note)
    expect(note).toContain("A line takes no text. Its fields: parent, kind, box, name,")
    expect(note).toContain("stroke, strokeWidth, dash, arrow")
    expect(note).not.toMatch(/\b(text|fill|slide|into)\b,/)
    expect(answer.fields).not.toHaveProperty("form")
  })
})

describe("operation names a script can call", () => {
  it("are all callable as functions, none a JavaScript keyword", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `const s = insert({ kind: "slide" }); remove({ target: s }); get().slides.includes(s)`,
    })
    expect(answer.fields).toMatchObject({ ok: true, result: false })
    expect(doom.slidesOf(by.fold(deck))).toHaveLength(1)
  })
})

describe("an insert that fills a slide's title placeholder", () => {
  it("answers the placeholder's id as the layer it made", async () => {
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
                props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") },
              },
            ],
          },
        ],
      }).doom
    const decks = memoryDecks(titled)
    const session: Session = { agent: "aira", mint: () => "m" }
    session.once = "make"
    const made = (await callTool("airdesign_execute", { script: "createDeck()" }, session, decks)).fields as {
      deck: string
      slides: string[]
    }
    session.once = "fill"
    const answer = await callTool(
      "airdesign_execute",
      {
        deck: made.deck,
        script: `insert({ parent: "${made.slides[0]!}", kind: "text", textStyle: "title", text: "Q3" })`,
      },
      session,
      decks,
    )
    const placeholder = doom.childrenOf(decks.decks.get(made.deck as never)!, made.slides[0] as doom.NodeId)[0]!.id
    expect(answer.fields).toMatchObject({ ok: true, result: placeholder })
  })
})
