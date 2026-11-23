import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { openDesign, openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await openDesign(page)
  await page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await expect(page.locator("[data-color-picker]").getByRole("group", { name: colorCopy.template })).toBeVisible()
}

export default { name: "blank-deck-colors", design: editor, drive }
