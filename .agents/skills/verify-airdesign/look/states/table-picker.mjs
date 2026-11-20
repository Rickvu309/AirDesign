import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../../apps/web/src/copy/table-copy.ts")

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await kit.page.getByRole("button", { name: tableCopy.sizeOf(4, 3), exact: true }).hover()
  await expect(kit.page.locator("[data-table-picker]")).toContainText(tableCopy.sizeOf(4, 3))
}

export default { name: "table-picker", design: "/screens/s43-07-editor-tools-table", drive }
