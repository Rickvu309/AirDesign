import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../../apps/web/src/copy/table-copy.ts")

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(3, 3), exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  for (const word of ["Region", "Revenue", "Growth", "Europe"]) {
    await page.keyboard.type(word)
    await page.keyboard.press("Tab")
  }
  await page.keyboard.type("4.2")
  await expect(table.locator('[data-table-cell="1.1"] [data-typing]')).toHaveCount(1)
}

export default { name: "table-typing", design: editor, drive }
