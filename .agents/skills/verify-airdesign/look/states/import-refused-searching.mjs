import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?q=quarterly")
  await expect(kit.page.getByRole("heading", { name: "No decks match “quarterly”" })).toBeVisible()
  await kit.page.locator("input[type=file]").setInputFiles({
    name: "refused.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("not a PowerPoint"),
  })
  await kit.page
    .getByRole("button", { name: productCopy.importChooseAnother })
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
}

export default { name: "import-refused-searching", design: "/screens/s32-03-decks-new-deck-import-failed", drive }
