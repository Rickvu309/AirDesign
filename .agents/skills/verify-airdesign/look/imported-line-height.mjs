import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { transitionCopy } from "../bin/product-copy.mjs"
import { openDeck } from "./open-deck.mjs"

export async function importedFixedLineHeight(kit) {
  const { page, repo } = kit
  const { textCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, {
    name: "Fixed lines.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx")),
  })
  await page.locator('[data-slide-entry="7"]').click()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide7.xml#4"]').click()
  const line = page.locator("[data-design-element]").getByRole("textbox", { name: textCopy.lineHeight, exact: true })
  await expect(line).toBeVisible()
  return line
}
