import { themePresetById } from "@airdesign/skills"
import * as doom from "@airdesign/doom"
import { kitPieces, readKitPiece } from "@airdesign/kit"
import { readSkill, readSkillIndex } from "@airdesign/skills"
import { describe, expect, it } from "vitest"

import { callTool, emptyLog, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Answer = Record<string, any>

function agent() {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ...result, fields: result.fields as Answer }
  }
  const made = async () => {
    const { ok, fields } = await call("execute", { script: "createDeck()" })
    expect(ok, JSON.stringify(fields)).toBe(true)
    return fields as { deck: string; slides: string[] }
  }
  const fold = (deck: string) => decks.decks.get(deck as never)!
  return { call, made, fold }
}

const flat = (all: readonly doom.Resolved[]): readonly doom.Resolved[] =>
  all.flatMap((each) => [each, ...flat(each.children)])
const firstRun = (painted: readonly doom.Resolved[], id: string) =>
  painted.find((each) => each.id === id)?.text?.lines[0]?.runs[0]

describe("copy from the kit", () => {
  it("copies a piece into decks with two themes, and each copy takes its deck's colours and fonts", async () => {
    for (const theme of ["midnight", "consulting"] as const) {
      const by = agent()
      const { deck } = await by.made()
      const answer = await by.call("execute", {
        deck,
        script: `
          variables({ theme: "${theme}" })
          const s = insert({ kind: "slide" })
          const [block] = copy({ from: "kit/title-block", parent: s, box: { x: 160, y: 120 } })
          ;({ s, block, lines: get({ target: block }).children })
        `,
      })
      expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
      const { s, block, lines } = answer.fields.result as { s: string; block: string; lines: string[] }
      const fold = by.fold(deck)
      const { colors, fonts } = themePresetById(theme)!.theme
      const painted = flat(doom.resolveSlide(fold, s as doom.NodeId, estimate))
      expect(doom.propOf(fold.nodes.get(block as doom.NodeId), "box")).toMatchObject({ x: 160, y: 120, w: 1680 })
      expect(firstRun(painted, lines[0]!)).toMatchObject({ font: fonts.heading, color: colors.text })
      expect(firstRun(painted, lines[1]!)).toMatchObject({ font: fonts.body, color: colors.text2 })
    }
  })

  it("lands plain owned layers: editing the copy never touches the piece", async () => {
    const before = structuredClone(readKitPiece("title-block"))
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `
        const s = insert({ kind: "slide" })
        const [block] = copy({ from: "kit/title-block", parent: s, box: { x: 160, y: 120 } })
        const [title] = get({ target: block }).children
        update({ target: title, text: "Revenue grew 18% on two new markets" })
        ;[block, title]
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const [block, title] = answer.fields.result as [string, string]
    const fold = by.fold(deck)
    for (const id of [block, ...doom.childrenOf(fold, block as doom.NodeId).map((each) => each.id)])
      expect(fold.nodes.get(id as doom.NodeId)).not.toHaveProperty("instance")
    expect(doom.propOf(fold.nodes.get(title as doom.NodeId), "text")?.chars).toBe("Revenue grew 18% on two new markets")
    expect(readKitPiece("title-block")).toEqual(before)
  })

  it("lands a script that copies two pieces and edits one as one edit, and undo_run takes it all back", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const before = by.fold(deck)
    const answer = await by.call("execute", {
      deck,
      script: `
        const s = "${slides[0]}"
        const [top] = copy({ from: "kit/title-block", parent: s, box: { x: 160, y: 120 } })
        const [low] = copy({ from: "kit/title-block", parent: s, box: { x: 160, y: 600, w: 1200 } })
        update({ target: get({ target: low }).children[1], text: "Source: company filings, 2026" })
        ;[top, low]
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(answer.fields.rev).toBe(before.rev + 1)
    expect(answer.fields.made.map((each: { verb: string }) => each.verb)).toEqual(["copy", "copy"])
    const [, low] = answer.fields.result as [string, string]
    expect(doom.propOf(by.fold(deck).nodes.get(low as doom.NodeId), "box")).toMatchObject({ w: 1200 })
    const undone = await by.call("undo_run", { deck, runId: answer.fields.runId })
    expect(undone.ok, JSON.stringify(undone.fields)).toBe(true)
    expect(doom.childrenOf(by.fold(deck), slides[0] as doom.NodeId).map((each) => each.id)).toEqual(
      doom.childrenOf(before, slides[0] as doom.NodeId).map((each) => each.id),
    )
  })

  it("gives a comparison a third column when the agent copies one, and the three share the width", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `
        const [pair] = copy({ from: "kit/comparison", parent: "${slides[0]}", box: { x: 120, y: 320 } })
        copy({ targets: [get({ target: pair }).children[1]] })
        ;({ pair, columns: get({ target: pair }).children.map((column) => get({ target: column }).box) })
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const { columns } = answer.fields.result as { columns: { x: number; w: number }[] }
    expect(columns.map((column) => Math.round(column.w))).toEqual([496, 496, 496])
    expect(answer.fields.problems).toEqual([])
  })

  it("refuses a piece the kit does not hold, and points to the kit's list", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `copy({ from: "kit/no-such-piece", parent: "${slides[0]}" })`,
    })
    expect(answer.ok).toBe(false)
    expect(answer.fields).toMatchObject({ op: 1, verb: "copy", field: "from" })
    expect(answer.fields.note).toContain('airdesign_read_skill({ name: "kit" })')
  })

  it("refuses from together with targets, and parent or box without from", async () => {
    const by = agent()
    const { deck, slides } = await by.made()
    const both = await by.call("execute", {
      deck,
      script: `copy({ from: "kit/title-block", targets: ["${slides[0]}"], parent: "${slides[0]}" })`,
    })
    expect(both.fields).toMatchObject({ verb: "copy", field: "targets" })
    const placed = await by.call("execute", {
      deck,
      script: `copy({ targets: ["${slides[0]}"], box: { x: 0, y: 0 } })`,
    })
    expect(placed.fields).toMatchObject({ verb: "copy", field: "box" })
  })

  it("lists every piece in the kit skill, with its size", () => {
    expect(readSkillIndex().skills.map((skill) => skill.name)).toContain("kit")
    const kit = readSkill("kit")?.markdown ?? ""
    for (const piece of kitPieces())
      expect(kit).toContain(`\`kit/${piece.name}\` (${String(piece.size.w)} by ${String(piece.size.h)})`)
  })
})
