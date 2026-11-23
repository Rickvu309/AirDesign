import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  const shadow = panel.getByRole("group", { name: "Shadow preset", exact: true })
  await shadow.getByRole("button", { name: "Middle", exact: true }).click()
  await expect(shadow.getByRole("button", { name: "Middle", exact: true })).toHaveAttribute("aria-pressed", "true")
  await panel.getByRole("heading", { name: "Shadow", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-effects", design: element, drive }
