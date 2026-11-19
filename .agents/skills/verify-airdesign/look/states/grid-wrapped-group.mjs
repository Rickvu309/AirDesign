import { expect } from "@playwright/test"

const design = "/screens/s41-05-editor-grid-wrapped"

async function drive(kit) {
  await kit.page.goto(design)
  await expect(kit.page.locator("[data-editor-grid]")).toBeVisible()
  await expect(kit.page.locator("[data-editor-grid] [data-grid-card]").first()).toBeVisible()
  await expect(kit.page.locator("[data-editor-grid] [data-group-rule]")).toHaveCount(0)
}

export default { name: "grid-wrapped-group", design, drive }
