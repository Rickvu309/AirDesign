import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape")
  await selectMany(kit.page, ["w:2"])
  const field = kit.page.locator("[data-design-element]").getByRole("textbox", { name: "Opacity", exact: true })
  await field.fill("60")
  await field.press("Enter")
  await expect(field).toHaveValue("60")
}

export default { name: "design-opacity", design: element, drive }
