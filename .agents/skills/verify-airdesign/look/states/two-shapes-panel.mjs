import { group } from "../doom-deck.mjs"
import { pictureCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape", "ellipse")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  await group(panel, pictureCopy.color).getByRole("button").first().click()
  await group(page.locator("[data-color-picker]")).first().getByRole("button").nth(5).click()
  await page.keyboard.press("Escape")
  await selectMany(page, ["w:2", "w:3"])
}

export default { name: "two-shapes-panel", design: element, drive }
