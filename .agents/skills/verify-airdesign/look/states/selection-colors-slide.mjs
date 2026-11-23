import { expect } from "@playwright/test"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape", "ellipse")
  const panel = kit.page.locator("[data-design-panel]")
  await expect(kit.page.locator("[data-selection-colors]")).toBeVisible()
  await panel.evaluate((each) => {
    each.scrollTop = each.scrollHeight
  })
}

export default { name: "selection-colors-slide", design: slidePanel, drive }
