import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { designing, element, selectTitle } from "../doom-design.mjs"

async function drive(kit) {
  const opened = await designing(kit)
  await selectTitle(kit, opened)
  const panel = kit.page.locator("[data-design-element]")
  await panel.getByRole("group", { name: "Text color" }).getByRole("button").first().click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: colorCopy.template })).toBeVisible()
}

export default { name: "color-picker-text", design: element, drive }
