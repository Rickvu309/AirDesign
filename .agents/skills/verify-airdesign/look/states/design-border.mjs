import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

export async function bordered(kit, kind = "Solid") {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  await panel
    .getByRole("group", { name: "Border", exact: true })
    .getByRole("button", { name: kind, exact: true })
    .click()
  const width = panel.getByRole("textbox", { name: "Border width", exact: true })
  await width.fill("6")
  await width.press("Enter")
  await expect(width).toHaveValue("6")
  await panel.getByRole("heading", { name: "Border", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-border", design: element, drive: (kit) => bordered(kit) }
