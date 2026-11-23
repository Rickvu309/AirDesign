import { group } from "../doom-deck.mjs"
import { doomEditorCopy, toolbarCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, panelTop } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.getByRole("button", { name: toolbarCopy.actions, exact: true }).click()
  await page.getByRole("combobox").fill("rocket")
  await group(page, doomEditorCopy.iconsGroup).getByRole("option", { name: "rocket", exact: true }).click()
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await expect(page.locator("[data-design-element]")).toBeVisible()
  await panelTop(page)
}

export default { name: "panel-icon", design: null, drive }
