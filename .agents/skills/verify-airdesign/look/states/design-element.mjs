import { expect } from "@playwright/test"
import { designing, element, selectTitle } from "../doom-design.mjs"

export async function titleChosen(kit) {
  const opened = await designing(kit)
  await selectTitle(kit, opened)
  await expect(kit.page.locator("[data-design-element]")).toBeVisible()
  return opened
}

export default { name: "design-element", design: element, drive: titleChosen }
