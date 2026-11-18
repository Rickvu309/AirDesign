import { expect } from "@playwright/test"

const design = "/screens/s41-05-editor-grid-wrapped"

async function drive(kit) {
  await kit.page.goto(design)
  await expect(kit.page.locator("[data-editor-grid]")).toBeVisible()
  await expect(kit.page.locator("[data-group-rule]")).toBeVisible()
  await expect(kit.page.locator("[data-section-head]").filter({ hasText: "Part 1:" })).toBeVisible()
}

export default { name: "grid-wrapped-group", design, drive }
