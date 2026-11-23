import { expect } from "@playwright/test"
import { designing, element, node, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const corners = page.locator("[data-design-element]").getByRole("textbox", { name: "Corners", exact: true })
  await corners.fill("20")
  await corners.press("Enter")
  await expect(corners).toHaveValue("20")
  const shape = node(page, "w:2")
  const box = await shape.boundingBox()
  await page.mouse.move(box.x + box.width, box.y + box.height)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + 60, box.y + box.height + 90, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await shape.boundingBox()).height).toBeGreaterThan(box.height + 80)
}

export default { name: "corners-resized", design: element, drive }
