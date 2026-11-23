import { group } from "../doom-deck.mjs"
import { expect } from "@playwright/test"
import { colorCopy, pictureCopy } from "../../bin/product-copy.mjs"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape")
  await selectMany(kit.page, ["w:2"])
  const panel = kit.page.locator("[data-design-element]")
  await group(panel, pictureCopy.color).getByRole("button").first().click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: colorCopy.template })).toBeVisible()
}

export default { name: "color-picker-fill", design: element, drive }
