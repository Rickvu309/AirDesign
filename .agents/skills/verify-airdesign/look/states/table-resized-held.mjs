import { fixtureDeck } from "../fixture-deck.mjs"
import { expect } from "@playwright/test"

const heldStill = 1000

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "table-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator("[data-slide-paint] [data-canvas-table]").click()
  await expect(page.locator("[data-design-element]")).toBeVisible()
  const corner = await page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]').boundingBox()
  const from = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 120, from.y + 60, { steps: 8 })
  await page.waitForTimeout(heldStill)
  await page.mouse.up()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toBeVisible()
}

export default { name: "table-resized-held", design: "/screens/s43-09-editor-tools-design-element", drive }
