import { decide, elementId, openRegister, writeTextValue, type Register } from "@airdesign/document"
import { readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { withFileFloors } from "@/deck-paint"
import { exportedParts } from "@/exported-parts"
import { judgedDeck, judgedOf, reportOf } from "./use-findings-report"

type Parts = ReadonlyMap<string, Uint8Array>

let parts: Parts = new Map()

beforeAll(async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  parts = read.parts
}, 30_000)

function typed(register: Register, node: string, text: string): Register {
  const id = elementId(node)
  const added = decide(register, { command: "add", node: id, floor: "", route: register.route })
  if (added.decision === "refuse") throw new Error(added.code)
  const value = writeTextValue([{ from: 0, runs: [{ from: -1, text }] }])
  const edited = decide(added.register, { command: "person", node: id, value })
  if (edited.decision === "refuse") throw new Error(edited.code)
  return edited.register
}

it("judges the words a deck holds now and re-reads only the slide an edit changed", () => {
  const kept = judgedDeck()
  const opened = openRegister("", "deck")
  const first = judgedOf(exportedParts(parts, opened), kept)
  expect(first.length).toBeGreaterThan(40)
  const slide = first.find((each) => each.elements.some((element) => element.from === "slide" && element.text !== null))
  const target = slide?.elements.find((element) => element.from === "slide" && element.text !== null)
  if (slide === undefined || target === undefined) throw new Error("no slide with text")
  const held = new Map([...kept.slides].map(([part, judged]) => [part, judged.resolved]))
  const words = "Words an agent wrote into this box"
  const second = judgedOf(exportedParts(parts, withFileFloors(typed(opened, target.node, words), parts)), kept)
  const shown = second.flatMap((each) => each.elements).find((element) => element.node === target.node)
  expect(shown?.text?.paragraphs[0]?.runs.map((run) => run.text).join("")).toBe(words)
  const reread = [...kept.slides].filter(([part, judged]) => held.get(part) !== judged.resolved).map(([part]) => part)
  expect(reread).toHaveLength(1)
})

it("says a revision is broken when the tab cannot export it, instead of reporting nothing", async () => {
  const opened = openRegister("", "deck")
  const first = judgedOf(exportedParts(parts, opened), judgedDeck())
  const target = first
    .flatMap((slide) => slide.elements)
    .find((element) => element.from === "slide" && element.text !== null)
  if (target === undefined) throw new Error("no text")
  const broken = {
    ...opened,
    nodes: [...opened.nodes, target.node],
    elements: { [target.node]: null },
  } as unknown as Register
  expect(() => exportedParts(parts, broken)).toThrow()
  expect(await reportOf(parts, broken, judgedDeck(), async () => ({}))).toEqual({ findings: [], broken: true })
  const fine = await reportOf(parts, opened, judgedDeck(), async () => ({}))
  expect(fine).not.toHaveProperty("broken")
})
