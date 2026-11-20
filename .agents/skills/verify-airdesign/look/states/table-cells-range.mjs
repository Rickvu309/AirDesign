import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

const require = createRequire(import.meta.url)
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")
const { shortcutCopy } = require("../../../../../apps/web/src/copy/shortcut-copy.ts")

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "table-added.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await table.locator('[data-table-cell="0.0"]').click()
  await table.locator('[data-table-cell="1.1"]').click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(table.locator("[data-table-picked]")).toHaveCount(4)
}

export default { name: "table-cells-range", design: "/screens/s43-09-editor-tools-design-element", drive }
