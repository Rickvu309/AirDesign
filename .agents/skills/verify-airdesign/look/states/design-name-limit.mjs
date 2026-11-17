import { expect } from "@playwright/test"
import element from "./design-element.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await element.drive(kit)
  await unfold(kit.page.locator("[data-design-element]"), "Name and alt text")
  const name = kit.page.locator("[data-design-element]").getByRole("textbox", { name: "Name", exact: true })
  await name.scrollIntoViewIfNeeded()
  const typed = "Quarterly revenue by region ".repeat(8).trim()
  await name.fill(typed)
  await name.press("Enter")
  await expect(
    name
      .locator("xpath=ancestor::label")
      .locator("..")
      .getByText("Use 200 characters or fewer.")
      .or(kit.page.locator("[data-sonner-toast]")),
  ).toBeVisible()
}

export default { name: "design-name-limit", design: "/screens/s43-09-editor-tools-design-element", drive }
