import { editorCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { entries } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await expect(entries(page)).toHaveCount(1)
  await page.getByRole("button", { name: "Choose a layout for the new slide", exact: true }).click()
  const labels = Object.values(editorCopy.slideStarts)
  const items = page.getByRole("menuitem")
  await expect(items).toHaveCount(labels.length)
  for (const [at, label] of labels.entries()) await expect(items.nth(at)).toHaveAccessibleName(label)
  if ((await page.locator("[data-layout-menu]").count()) > 0) {
    await expect(page.locator("[data-layout-thumb] [data-slide-paint]")).toHaveCount(labels.length)
    await expect(page.locator("[data-layout-thumb] [data-fonts-pending]")).toHaveCount(0)
  }
}

export default { name: "new-slide-menu", design: editor, drive }
