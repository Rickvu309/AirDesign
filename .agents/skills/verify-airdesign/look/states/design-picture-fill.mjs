import { expect } from "@playwright/test"
import { designing, dropPicture, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit)
  await selectMany(kit.page, [await dropPicture(kit)])
  await expect(kit.page.locator("[data-design-element]")).toBeVisible()
}

export default { name: "design-picture-fill", design: element, drive }
