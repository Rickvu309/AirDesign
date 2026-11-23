import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const opacity = page.locator("[data-design-element]").getByRole("textbox", { name: "Opacity", exact: true })
  await opacity.fill("50")
  await opacity.press("Enter")
  await expect(opacity).toHaveValue("50")
  await page.keyboard.press("l")
  await page.keyboard.press("Enter")
}

export default { name: "design-control-entered", design: element, drive }
