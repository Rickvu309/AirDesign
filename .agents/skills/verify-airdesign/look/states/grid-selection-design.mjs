import { expect } from "@playwright/test"
import { selectSlides } from "../grid-selection.mjs"

async function drive(kit) {
  await selectSlides(kit)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
}

export default { name: "grid-selection-design", design: "/screens/s43-02-editor-tools-design-panel", drive }
