import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../../apps/web/src/copy/table-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "table-added.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await table.locator('[data-table-cell="1.1"]').dblclick()
  await page.keyboard.type("North")
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  const size = page.locator("[data-table-cells]").getByRole("textbox", { name: tableCopy.textSize, exact: true })
  await size.fill("32")
  await size.press("Enter")
  await expect(table.locator('[data-table-cell="1.1"]')).toContainText("North")
  await page.waitForTimeout(400)
}

export default { name: "table-whole-styled", design: "/screens/s43-09-editor-tools-design-element", drive }
