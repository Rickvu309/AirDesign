import { expect } from "@playwright/test"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
}

export default { name: "design-panel-reloaded", design: slidePanel, drive }
