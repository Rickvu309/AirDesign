import { expect } from "@playwright/test"
import { designing } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  const icons = page.getByRole("group", { name: "Icons", exact: true }).getByRole("button")
  await expect(icons.first()).toBeVisible()
  await expect(icons.filter({ hasNot: page.locator("svg") })).toHaveCount(0)
  const field = page.getByRole("searchbox")
  await page.keyboard.press("Tab")
  await field.focus()
  await expect(field).toBeFocused()
}

export default { name: "icon-search-focus", design: null, drive }
