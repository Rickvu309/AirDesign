import { blankDeckName } from "@airdesign/catalog"
import { indexPages } from "@airdesign/live"
import { openedMasks, readPackage } from "@airdesign/pptx"
import { deckTemplates, startIndexFile, templateFile } from "@airdesign/templates"
import { expect, it } from "vitest"

import { productCopy } from "@/copy/product-copy"
import { indexedParts } from "@/editing/index-deck"

declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readFileSync(path: string, encoding: "utf8"): string
    writeFileSync(path: string, data: string): void
  }
}

const fs = process.getBuiltinModule("node:fs")
const templates = new URL("../../../../packages/templates/", import.meta.url).pathname

async function startIndex(id: string): Promise<unknown> {
  const read = await readPackage(new Uint8Array(fs.readFileSync(`${templates}${templateFile(id, true)}`)))
  if (!read.ok) throw new Error(read.reason)
  const paged = indexPages(indexedParts(openedMasks(read.parts)), () => "start")
  if (!paged.ok) throw new Error(paged.refusal)
  return paged.pages
}

it.each(deckTemplates)("keeps the stored index of the $id start deck equal to the one a tab builds", async ({ id }) => {
  const built = await startIndex(id)
  const stored = `${templates}${startIndexFile(id)}`
  if (process.env.START_INDEX_WRITE === "1") fs.writeFileSync(stored, `${JSON.stringify(built, null, 2)}\n`)
  expect(JSON.parse(fs.readFileSync(stored, "utf8"))).toEqual(built)
})

it("names an agent's unnamed deck as New deck names a blank one", () => {
  expect(blankDeckName).toBe(productCopy.blankDeck)
})
