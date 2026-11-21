import { productCopy, templatePickerCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await kit.page.getByRole("menuitem", { name: templatePickerCopy.fromTemplate, exact: true }).click()
  await expect(kit.page.locator("[data-template] [data-thumb-paint]")).toHaveCount(3)
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "template-picker", design: "/screens/s32-04-decks-new-deck-template-picker", drive }
