import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape")
  await selectMany(kit.page, ["w:2"])
  await expect(
    kit.page.locator("[data-design-element]").getByRole("textbox", { name: "Corners", exact: true }),
  ).toBeVisible()
}

export default { name: "design-corners-shape", design: element, drive }
