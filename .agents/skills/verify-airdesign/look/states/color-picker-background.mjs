import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape")
  await kit.page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: colorCopy.template })).toBeVisible()
}

export default { name: "color-picker-background", design: slidePanel, drive }
