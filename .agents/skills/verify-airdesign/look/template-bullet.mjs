import path from "node:path"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"

export const bulletOf = (item) => item.evaluate((node) => getComputedStyle(node, "::before").content)

export async function tabbedToTemplateBullet(kit) {
  const { page, repo } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, {
    name: "Bullets.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx")),
  })
  await page.locator('[data-slide-entry="2"]').click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide2.xml#6"]')
    .dblclick({ position: { x: 40, y: 12 } })
  const items = page.locator('[data-slide-paint] [contenteditable="true"] [data-paragraph]')
  const item = (words) => items.filter({ hasText: new RegExp(`^${words}$`) })
  await item("Arc Jet Case Study").click()
  await page.keyboard.press("Tab")
  await expect(item("Arc Jet Case Study")).toHaveAttribute("data-level", "1")
  return item
}
