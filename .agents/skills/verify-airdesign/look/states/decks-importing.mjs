import { expect } from "@playwright/test"
import path from "node:path"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await expect(kit.page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await kit.page.evaluate(() => {
    File.prototype.arrayBuffer = () => new Promise(() => {})
  })
  await kit.page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(kit.page.getByText("Importing", { exact: true })).toBeVisible()
}

export default { name: "decks-importing", design: "/screens/s32-02-decks-new-deck-importing", drive }
