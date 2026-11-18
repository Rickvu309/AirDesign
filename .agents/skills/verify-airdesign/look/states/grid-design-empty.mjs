import { expect } from "@playwright/test"
import { openRowDeck } from "../grid-row-add.mjs"

async function drive(kit) {
  const { page } = kit
  await openRowDeck(kit, 8)
  await page.locator('[data-slide-entry="2"]').click()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  await page.mouse.click(room.x + 40, room.y + room.height - 120)
  await expect(page.locator("[data-editor-grid] [data-slide-entry][data-selected]")).toHaveCount(0)
}

export default { name: "grid-design-empty", design: "/screens/s43-02-editor-tools-design-panel", drive }
