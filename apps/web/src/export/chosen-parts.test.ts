import { openRegister } from "@airdesign/document"
import { readParts, readSlides } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { chosenParts } from "./chosen-parts"

async function fixture(name: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

it("keeps only the chosen slide of a deck no slide command has touched yet", async () => {
  const parts = await fixture("tall-glyph-before.pptx")
  const [first, second] = readSlides(parts)
  if (first === undefined || second === undefined) throw new Error("slides")
  const chosen = chosenParts(parts, openRegister("", "tall"), [1])
  expect(readSlides(chosen)).toEqual([second])
  expect(chosen.has(first.part)).toBe(false)
  expect(chosen.get(second.part)).toBe(parts.get(second.part))
})

it("exports the whole deck as before when no slide is named", async () => {
  const parts = await fixture("tall-glyph-before.pptx")
  const register = openRegister("", "tall")
  expect(chosenParts(parts, register, undefined)).toBe(exportedParts(parts, register))
})
