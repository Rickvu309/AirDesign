import { readDeckId } from "@airdesign/catalog"
import { call, openDeck, type Deck } from "@airdesign/engine"
import { indexPackage, paintReader, readParts, shownTheme } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "./exported-parts"

type Parts = ReadonlyMap<string, Uint8Array>

async function neutralParts(): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL("../../../packages/templates/files/neutral.pptx", import.meta.url)))
}

function openedDeck(parts: Parts): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index = indexPackage(parts)
  return { ...opened, register: { ...opened.register, index: { ...index, total: index.elements.length, pages: [] } } }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let at = 0; at < left.length; at += 1) if (left[at] !== right[at]) return false
  return true
}

function changedParts(before: Parts, after: Parts): readonly string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((name) => {
    const left = before.get(name)
    const right = after.get(name)
    return left === undefined || right === undefined || !sameBytes(left, right)
  })
}

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const

it("changes only the theme part when applying Midnight or Editorial to a Neutral deck, keeps dark-mode text readable, and undoes to identical bytes", async () => {
  const parts = await neutralParts()
  const start = openedDeck(parts)
  const started = call("start_run", start, agent, {
    deck: "deck",
    runId: "run",
    elements: [{ node: "deck.templateStyle1" }],
  })
  if (!started.ok) throw new Error(started.refusal)
  const applied = call("edit_deck", started.deck, agent, {
    deck: "deck",
    base: started.deck.revision,
    changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "midnight" } }],
  })
  if (!applied.ok) throw new Error(applied.refusal)
  const midnight = exportedParts(parts, applied.deck.register)
  expect(changedParts(parts, midnight)).toEqual(["ppt/theme/theme1.xml"])
  expect(shownTheme(midnight, "ppt/slides/slide1.xml")).toEqual({
    dk1: "F4F6FA",
    lt1: "0E1626",
    dk2: "9AA6BA",
    lt2: "1A2438",
    accent1: "6B9BFF",
    accent2: "34C3A6",
    accent3: "F5B54A",
    accent4: "A98BFA",
    accent5: "F06A73",
    accent6: "8AD167",
    hlink: "7AA6FF",
    folHlink: "C3A9FF",
    major: "Inter SemiBold",
    minor: "Inter",
  })
  const painted = paintReader(midnight).slide("ppt/slides/slide1.xml")
  expect(JSON.stringify(painted.background)).toContain("0E1626")
  expect(JSON.stringify(painted.elements)).toContain("F4F6FA")
  const editorial = call("edit_deck", applied.deck, agent, {
    deck: "deck",
    base: applied.deck.revision,
    changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "editorial" } }],
  })
  if (!editorial.ok) throw new Error(editorial.refusal)
  const warm = exportedParts(parts, editorial.deck.register)
  expect(changedParts(parts, warm)).toEqual(["ppt/theme/theme1.xml"])
  expect(shownTheme(warm, "ppt/slides/slide1.xml")).toMatchObject({
    dk1: "231F1C",
    lt1: "FBF8F3",
    accent1: "B4532A",
    major: "Source Serif 4 SemiBold",
    minor: "Inter",
  })
  const undone = call("undo_run", editorial.deck, person, { deck: "deck", runId: "run" })
  if (!undone.ok) throw new Error(undone.refusal)
  expect(changedParts(parts, exportedParts(parts, undone.deck.register))).toEqual([])
})
