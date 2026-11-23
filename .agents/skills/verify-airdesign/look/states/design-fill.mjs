import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "shape")
  await selectMany(kit.page, ["w:2"])
  const kinds = kit.page.locator("[data-design-element]").getByRole("group", { name: "Fill", exact: true })
  await kinds.getByRole("button", { name: "Gradient", exact: true }).click()
  await expect(kinds.getByRole("button", { name: "Gradient", exact: true })).toHaveAttribute("aria-pressed", "true")
}

export default { name: "design-fill", design: element, drive }
