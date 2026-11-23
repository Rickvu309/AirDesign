import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "text", "note")
  await selectMany(kit.page, ["w:1", "w:6"])
  await expect(kit.page.locator("[data-design-element]")).toHaveAttribute("data-design-element", "w:1 w:6")
}

export default { name: "design-many-text", design: element, drive }
