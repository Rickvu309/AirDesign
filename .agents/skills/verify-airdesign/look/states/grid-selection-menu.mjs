import { expect } from "@playwright/test"
import { selectSlides } from "../grid-selection.mjs"

async function drive(kit) {
  await selectSlides(kit)
  await kit.page.locator('[data-slide-entry="2"]').click({ button: "right" })
  await expect(kit.page.getByRole("menu")).toBeVisible()
}

export default { name: "grid-selection-menu", design: "/screens/s41-01-editor-grid-default", drive }
