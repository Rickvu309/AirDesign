import path from "node:path"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"

export async function tabbedInTemplate(kit) {
  const { page, repo } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, {
    name: "Levels.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")),
  })
  const deck = path.posix.basename(new URL(page.url()).pathname)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.locator('[data-slide-entry="16"]').click()
  await page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide16.xml#3"]').dblclick()
  const items = page.locator('[data-slide-paint] [contenteditable="true"] [data-paragraph]')
  const item = (word) => items.filter({ hasText: new RegExp(`^${word}$`) })
  await item("NCCER").click()
  await page.keyboard.press("Tab")
  await expect(item("NCCER")).toHaveAttribute("data-level", "2")
  return item
}
