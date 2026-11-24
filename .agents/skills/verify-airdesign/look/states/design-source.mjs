import { expect } from "@playwright/test"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit)
  const field = kit.page.locator("[data-design-panel] [data-slide-source]")
  if ((await field.count()) === 0) return
  await field.fill("Source: Company filings, team analysis")
  await field.press("Enter")
  await expect(kit.page.locator('[data-slide-box] [data-footer="source"]')).toBeVisible()
}

export default { name: "design-source", design: slidePanel, drive }
