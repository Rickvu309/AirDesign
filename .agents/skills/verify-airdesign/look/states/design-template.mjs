import { expect } from "@playwright/test"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit)
  await expect(kit.page.locator("[data-design-panel] [data-template-style]")).toBeVisible()
}

export default { name: "design-template", design: slidePanel, drive }
