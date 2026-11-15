import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: "Insert table", exact: true }).click()
  await kit.page.getByRole("button", { name: "4 rows, 3 columns", exact: true }).hover()
  await expect(kit.page.locator("[data-table-picker]")).toContainText("4 rows, 3 columns")
}

export default { name: "table-picker", design: "/screens/s43-07-editor-tools-table", drive }
