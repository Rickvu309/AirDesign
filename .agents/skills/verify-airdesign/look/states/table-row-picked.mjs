import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"
import { editor } from "../editor-screen.mjs"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../../apps/web/src/copy/table-copy.ts")

async function drive(kit) {
  await fixtureDeck(kit, "table-added.pptx")
  const table = kit.page.locator("[data-slide-paint] [data-canvas-table]")
  await table.click()
  await kit.page.getByRole("button", { name: tableCopy.row(2), exact: true }).click()
  await expect(table.locator("[data-table-picked]")).toHaveCount(3)
}

export default { name: "table-row-picked", design: editor, drive }
