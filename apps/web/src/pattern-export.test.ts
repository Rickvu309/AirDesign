import { readDeckId } from "@airdesign/catalog"
import { call, openDeck, type Deck } from "@airdesign/engine"
import { indexPackage, readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "./exported-parts"

type Parts = ReadonlyMap<string, Uint8Array>

async function blankParts(): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL("../../../scripts/pptx-fixtures/blank.pptx", import.meta.url)))
}

function openedDeck(parts: Parts): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index = indexPackage(parts)
  return { ...opened, register: { ...opened.register, index: { ...index, total: index.elements.length, pages: [] } } }
}

const item = (at: number) => ({
  title: `Heading ${String(at + 1)}`,
  value: `Q${String(at + 1)}`,
  note: "A note under it",
  points: ["First point", "Second point", "Third point"],
  icon: "users",
})

it.each([
  ["kpi", 4],
  ["cards", 3],
  ["compare", 2],
  ["matrix", 4],
  ["timeline", 5],
] as const)("exports a %s pattern with every paragraph written", async (pattern, count) => {
  const parts = await blankParts()
  const deck = openedDeck(parts)
  const slide = deck.register.index?.slides[0]?.id
  const result = call(
    "edit_deck",
    deck,
    { actor: "agent", runId: "run" },
    {
      deck: "deck",
      base: deck.revision,
      changes: [
        {
          op: "diagram",
          slide,
          pattern,
          box: { x: 64, y: 110, w: 832, h: 380 },
          items: Array.from({ length: count }, (_, at) => item(at)),
        },
      ],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  const xml = new TextDecoder().decode(exportedParts(parts, result.deck.register).get("ppt/slides/slide1.xml"))
  expect(xml).toContain("Heading 1")
  if (pattern !== "kpi" && pattern !== "timeline") expect(xml).toContain("Third point")
})
