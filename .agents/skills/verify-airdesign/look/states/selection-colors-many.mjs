import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape", "ellipse")
  await selectMany(kit.page, ["w:2", "w:3"])
  const panel = kit.page.locator("[data-design-panel]")
  await expect(kit.page.locator("[data-selection-colors]")).toBeVisible()
  await panel.evaluate((each) => {
    each.scrollTop = each.scrollHeight
  })
}

export default { name: "selection-colors-many", design: element, drive }
