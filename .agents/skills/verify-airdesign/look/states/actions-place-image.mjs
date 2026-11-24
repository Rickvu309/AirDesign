import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await expect(page.locator("[data-actions-panel]")).toBeVisible()
}

export default { name: "actions-place-image", design: null, drive }
