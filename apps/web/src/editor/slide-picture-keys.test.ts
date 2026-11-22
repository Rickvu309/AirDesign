import { decide, elementId, openRegister, writeTextValue, type Register } from "@airdesign/document"
import { readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { withFileFloors } from "@/deck-paint"
import { exportedParts } from "@/exported-parts"
import { judgedDeck, judgedOf } from "./use-findings-report"
import { slideKeyCache, slideKeys } from "./slide-picture-keys"

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

it("keys every slide and changes only the key of the slide an edit touched", async () => {
  const opened = openRegister("", "deck")
  const kept = slideKeyCache()
  const first = await slideKeys(exportedParts(parts, opened), kept)
  expect(first.length).toBeGreaterThan(3)
  expect(new Set(first.map(({ key }) => key)).size).toBe(first.length)
  expect(first.every(({ key }) => /^[0-9a-f]{64}$/.test(key))).toBe(true)
  const target = judgedOf(exportedParts(parts, opened), judgedDeck())
    .flatMap((slide) => slide.elements)
    .find((element) => element.from === "slide" && element.text !== null)
  if (target === undefined) throw new Error("no text")
  const register = withFileFloors(typed(opened, target.node, "Words an agent wrote"), parts)
  const second = await slideKeys(exportedParts(parts, register), kept)
  const moved = second.filter(({ slide, key }) => first.find((each) => each.slide === slide)?.key !== key)
  expect(moved).toHaveLength(1)
  expect(await slideKeys(exportedParts(parts, register), slideKeyCache())).toEqual(second)
})

it("changes a slide's key when an embedded chart it holds changes, though the slide part is the same", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/office-chart.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const charted = read.parts
  const chart = [...charted.keys()].find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
  if (chart === undefined) throw new Error("no chart")
  const kept = slideKeyCache()
  const first = await slideKeys(charted, kept)
  const bytes = charted.get(chart) ?? new Uint8Array()
  const changed = new Map(charted).set(chart, Uint8Array.from([...bytes, 32]))
  const second = await slideKeys(changed, kept)
  const moved = second.filter(({ slide, key }) => first.find((each) => each.slide === slide)?.key !== key)
  expect(moved).toHaveLength(1)
  expect(await slideKeys(changed, slideKeyCache())).toEqual(second)
})
