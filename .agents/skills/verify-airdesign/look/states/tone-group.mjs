import { expect } from "@playwright/test"
import element from "./design-element.mjs"
import { selectToneText } from "../tone-selection.mjs"

async function drive(kit) {
  await selectToneText(kit)
  await kit.page.keyboard.press("Control+g")
  await expect(kit.page.locator("[data-design-element]")).toHaveAttribute(
    "data-design-element",
    /^\d+\.(?:\d+|n[0-9a-z]{12})$/,
  )
}

export default { name: "tone-group", design: element.design, drive }
