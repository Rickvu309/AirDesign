import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape", "line")
  await selectMany(kit.page, ["w:2", "w:4"])
  await expect(kit.page.locator("[data-design-element]")).toHaveAttribute("data-design-element", "w:2 w:4")
}

export default { name: "design-many-line", design: element, drive }
