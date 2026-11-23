import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape", "ellipse")
  await selectMany(page, ["w:2", "w:3"])
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await expect(page.locator("[data-design-element]").getByText("Frame", { exact: true })).toBeVisible()
}

export default { name: "frame-resize-to-fit", design: element, drive }
