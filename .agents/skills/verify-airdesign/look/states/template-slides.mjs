import { productCopy, templatePickerCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await kit.page.getByRole("menuitem", { name: templatePickerCopy.fromTemplate, exact: true }).click()
  await kit.page.locator('[data-template="midnight"]').click()
  await expect(kit.page.locator("[data-template-slide] [data-thumb-paint]")).toHaveCount(6)
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "template-slides", design: "/screens/s32-05-decks-new-deck-template-slides", drive }
