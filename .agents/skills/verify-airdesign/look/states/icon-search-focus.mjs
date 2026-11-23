import { group } from "../doom-deck.mjs"
import { doomEditorCopy, toolbarCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.getByRole("button", { name: toolbarCopy.actions, exact: true }).click()
  const icons = group(page, doomEditorCopy.iconsGroup).getByRole("option")
  await expect(icons.first()).toBeVisible()
  await expect(icons.filter({ hasNot: page.locator("svg") })).toHaveCount(0)
  const field = page.getByRole("combobox")
  await page.keyboard.press("Tab")
  await field.focus()
  await expect(field).toBeFocused()
}

export default { name: "icon-search-focus", design: null, drive }
