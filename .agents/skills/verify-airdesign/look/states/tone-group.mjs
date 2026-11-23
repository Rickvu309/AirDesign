import { expect } from "@playwright/test"
import { element } from "../doom-design.mjs"
import { selectToneText } from "../tone-selection.mjs"

async function drive(kit) {
  await selectToneText(kit)
  await kit.page.keyboard.press("ControlOrMeta+g")
  await expect(kit.page.locator("[data-selection-outline]")).toHaveCount(1)
  await expect(kit.page.locator("[data-design-element]")).toBeVisible()
}

export default { name: "tone-group", design: element, drive }
