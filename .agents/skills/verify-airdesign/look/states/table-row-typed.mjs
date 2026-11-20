import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

const require = createRequire(import.meta.url)
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "table-added.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await table.locator('[data-table-cell="1.0"]').dblclick()
  await page.keyboard.type("License cost over five years, in millions of dollars")
  await expect(table.locator('[data-table-cell="1.0"] [data-typing]')).toHaveCount(1)
  await page.waitForTimeout(400)
}

export default { name: "table-row-typed", design: null, drive }
