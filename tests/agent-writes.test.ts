import { readDeckId, traitWire } from "@airdesign/catalog"
import {
  openRegister,
  presentSlides,
  readSlideId,
  readTextValue,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { callTool, emptyLog, memoryTurns, type Session } from "@airdesign/mcp"
import { readParts, readSlides } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { exportedDeck } from "@/exported-parts"
import { indexedParts } from "@/index-deck"

type Parts = ReadonlyMap<string, Uint8Array>
type Landed = { readonly elements: readonly { readonly node: string; readonly version: number }[] }

async function opened(): Promise<{ readonly parts: Parts; readonly session: Session; readonly slide: string }> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const parts = await readParts(await fs.readFile(new URL("../scripts/pptx-fixtures/blank.pptx", import.meta.url)))
  const index = indexedParts(parts)
  const slide = readSlideId(index.slides[0]?.id)
  const deck = readDeckId("deck")
  if (slide === undefined || !deck.ok) throw new Error("blank deck")
  const register: Register = {
    ...openRegister("", ""),
    index: { ...index, format: 2, total: index.elements.length, pages: [] },
  }
  const session: Session = {
    caller: { actor: "agent", runId: "agent" },
    deck: { id: deck.deck, revision: 0, register },
    log: emptyLog(),
    now: 0,
    turns: memoryTurns(),
  }
  return { parts, session, slide }
}

function landed(session: Session, changes: readonly unknown[]): Landed {
  const result = callTool("airdesign_edit_deck", { deck: "deck", base: session.deck.revision, changes }, session)
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.content)}`)
  session.deck = result.deck
  const answer = result.content.find((part) => part.type === "text" && part.text.startsWith("{"))
  return JSON.parse(answer?.type === "text" ? answer.text : "{}") as Landed
}

function slideXml(parts: Parts, at = 0): string {
  const part = readSlides(parts)[at]?.part ?? ""
  return new TextDecoder().decode(parts.get(part))
}

function written(parts: Parts, session: Session, at = 0): string {
  const exported = exportedDeck(parts, session.deck.register)
  expect(exported.leftOut).toEqual([])
  return slideXml(exported.parts, at)
}

const box = { x: 64, y: 60, w: 400, h: 60 }

function readValue(session: Session, node: string | undefined): TextValue {
  const result = callTool("airdesign_read_deck", { deck: "deck" }, session)
  if (!result.ok || result.reported === undefined || !("elements" in result.reported)) throw new Error("read")
  const value = result.reported.elements.find((element) => element.node === node)?.value
  const read = typeof value === "string" ? readTextValue(value) : null
  if (read === null) throw new Error("text value")
  return read
}

describe("what the agent tools land, the tab writes", () => {
  it("writes a line break in plain text as a new paragraph, as Enter does", async () => {
    const { parts, session, slide } = await opened()
    landed(session, [{ op: "add", kind: "shape", slide, box, text: { value: "Line one\nLine two" } }])
    const paragraph = (words: string) =>
      `<a:p><a:r>(?:<a:rPr[^>]*/>)?<a:t>${words}</a:t></a:r><a:endParaRPr[^>]*/></a:p>`
    expect(written(parts, session)).toMatch(new RegExp(paragraph("Line one") + paragraph("Line two")))
  })

  it("writes a line break sent in each text form as a new paragraph", async () => {
    const { parts, session, slide } = await opened()
    const node = landed(session, [{ op: "add", kind: "shape", slide, box, text: { value: "One" } }]).elements[0]?.node
    landed(session, [{ op: "set", target: node, text: { value: "Set one\nSet two" } }])
    expect(written(parts, session)).toContain("<a:t>Set two</a:t>")
    const styled = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Styled one\nStyled two" }] }])
    const version = landed(session, [{ op: "set", target: node, text: { value: styled, size: 20 } }]).elements[0]
      ?.version
    expect(written(parts, session)).toContain("<a:t>Styled two</a:t>")
    landed(session, [{ node, readAt: version, value: "Value one\nValue two" }])
    expect(written(parts, session)).toContain("<a:t>Value two</a:t>")
  })

  it("writes a table added with words in its cells in the documented form", async () => {
    const { parts, session, slide } = await opened()
    const rows = [
      ["Milestone", "Owner"],
      ["Sign the commitment", "CFO\nFinance"],
    ].map((cells, at) => ({ from: at, cells: cells.map((text) => [{ from: 0, runs: [{ from: 0, text }] }]) }))
    landed(session, [{ op: "add", kind: "table", slide, table: { value: JSON.stringify({ rows }) } }])
    const xml = written(parts, session)
    for (const word of ["Milestone", "Owner", "Sign the commitment", "CFO", "Finance"])
      expect(xml).toContain(`<a:t>${word}</a:t>`)
  })

  it("writes a table added with the example the tool gives", async () => {
    const { parts, session, slide } = await opened()
    landed(session, [{ op: "add", kind: "table", slide, ...traitWire.table.fields.value.example }])
    expect(written(parts, session)).toContain("<a:t>Region</a:t>")
  })

  it("writes a chart added to a slide an agent added", async () => {
    const { parts, session, slide } = await opened()
    landed(session, [{ op: "add_slide", after: slide, layout: slide }])
    const added = presentSlides(session.deck.register)[1]?.id ?? ""
    const chart = JSON.stringify({
      kind: "bar",
      categories: ["Jul", "Aug"],
      series: [{ name: "Actual", values: [15.3, 16.1] }],
    })
    landed(session, [{ op: "add", kind: "chart", slide: added, box, chart: { value: chart } }])
    expect(written(parts, session, 1)).toContain("<c:chart ")
  })

  it("writes an added layer's paragraphs and runs numbered as places", async () => {
    const { parts, session, slide } = await opened()
    const value = JSON.stringify([
      {
        from: 0,
        runs: [
          { from: 0, text: "Revenue" },
          { from: 1, text: " up" },
        ],
      },
      { from: 1, runs: [{ from: 0, text: "$16.8M" }] },
    ])
    landed(session, [{ op: "add", kind: "shape", slide, box, text: { value } }])
    const xml = written(parts, session)
    for (const word of ["Revenue", " up", "$16.8M"]) expect(xml).toContain(`<a:t>${word}</a:t>`)
  })
  it("writes plain text on a layer of the file, keeping the first run's look, in each form", async () => {
    const { parts, session, slide } = await opened()
    const title = `${slide}.2`
    landed(session, [{ op: "set", target: title, text: { value: "Set title\nSecond line" } }])
    expect(written(parts, session)).toContain("<a:t>Second line</a:t>")
    landed(session, [{ node: title, readAt: 1, value: "Value title" }])
    expect(written(parts, session)).toContain("<a:t>Value title</a:t>")
  })

  it("refuses text that looks like JSON and is not a text value, in every form, and never writes it as words", async () => {
    const { session, slide } = await opened()
    const node = landed(session, [{ op: "add", kind: "shape", slide, box, text: { value: "One" } }]).elements[0]?.node
    for (const value of ['[{"from":0,"runs":[{"from":-1,"text":"A"}', JSON.stringify({ text: "Hello" })]) {
      for (const change of [
        { op: "add", kind: "shape", slide, box, text: { value } },
        { op: "set", target: node, text: { value } },
        { node, readAt: 1, value },
      ]) {
        const result = callTool(
          "airdesign_edit_deck",
          { deck: "deck", base: session.deck.revision, changes: [change] },
          session,
        )
        expect(result.ok, JSON.stringify(change)).toBe(false)
        expect(JSON.stringify(result.content)).toContain("looks like JSON")
      }
    }
  })

  it("numbers what the read returns by position and takes a from as a position in it, on a layer the agent added", async () => {
    const { parts, session, slide } = await opened()
    const node = landed(session, [{ op: "add", kind: "shape", slide, box, text: { value: "One" } }]).elements[0]?.node
    const text = (froms: readonly (readonly [number, number])[]) =>
      JSON.stringify(froms.map(([from, run], at) => ({ from, runs: [{ from: run, text: `Paragraph ${String(at)}` }] })))
    for (const froms of [
      [[0, 0]],
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0],
        [-1, 0],
      ],
      [
        [0, 0],
        [0, 0],
      ],
      [
        [0, -1],
        [1, -1],
        [2, -1],
      ],
    ] as const) {
      landed(session, [{ op: "set", target: node, text: { value: text(froms) } }])
      const shown = readValue(session, node)
      expect(shown.map((paragraph) => paragraph.from)).toEqual(froms.map((_, at) => at))
      expect(shown.flatMap((paragraph) => paragraph.runs.map((run) => run.from))).toEqual(froms.map(() => 0))
      for (let at = 0; at < froms.length; at += 1)
        expect(written(parts, session)).toContain(`<a:t>Paragraph ${String(at)}</a:t>`)
    }
  })

  it("names the change in a refusal about a table row", async () => {
    const { session, slide } = await opened()
    const rows = [0, 1].map((from) => ({ from, cells: [[{ from: 0, runs: [{ from: 0, text: "Cell" }] }]] }))
    const node = landed(session, [{ op: "add", kind: "table", slide, table: { value: JSON.stringify({ rows }) } }])
      .elements[0]?.node
    const outside = JSON.stringify({ rows: [{ from: 9, cells: rows[0]?.cells }] })
    const result = callTool(
      "airdesign_edit_deck",
      {
        deck: "deck",
        base: session.deck.revision,
        changes: [
          { op: "set", target: node, box: { x: 70 } },
          { op: "set", target: node, table: { value: outside } },
        ],
      },
      session,
    )
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result.content)).toContain("Change 2")
  })
})
