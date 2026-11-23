import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape", "ellipse")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("group", { name: "Color", exact: true }).getByRole("button").first().click()
  await page.locator("[data-color-picker]").getByRole("group").first().getByRole("button").nth(5).click()
  await page.keyboard.press("Escape")
  await selectMany(page, ["w:2", "w:3"])
}

export default { name: "two-shapes-panel", design: element, drive }
