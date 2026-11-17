import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import path from "node:path"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?q=quarterly")
  await kit.page.evaluate(() => {
    File.prototype.arrayBuffer = () => new Promise(() => {})
  })
  await kit.page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await kit.page
    .getByText(productCopy.importing, { exact: true })
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
  await expect(kit.page.getByRole("heading", { name: "No decks match “quarterly”" })).toBeVisible()
}

export default { name: "importing-searching", design: "/screens/s32-02-decks-new-deck-importing", drive }
