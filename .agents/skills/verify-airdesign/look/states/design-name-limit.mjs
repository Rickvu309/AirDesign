import { expect } from "@playwright/test"
import element from "./design-element.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await element.drive(kit)
  await unfold(kit.page.locator("[data-design-element]"), "Name and alt text")
  const name = kit.page.locator("[data-design-element]").getByRole("textbox", { name: "Name", exact: true })
  await name.scrollIntoViewIfNeeded()
  await name.fill("é".repeat(101))
  await expect(name).toHaveValue("é".repeat(100))
  await name.press("Enter")
  await expect(name).toHaveValue("é".repeat(100))
  await expect(kit.page.locator("[data-sonner-toast]")).toHaveCount(0)
}

export default { name: "design-name-limit", design: "/screens/s43-09-editor-tools-design-element", drive }
