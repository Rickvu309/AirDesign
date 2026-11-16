import { expect } from "@playwright/test"
import element from "./design-element.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await element.drive(kit)
  await unfold(kit.page.locator("[data-design-element]"), "Name and alt text")
  const name = kit.page.locator("[data-design-element]").getByRole("textbox", { name: "Name", exact: true })
  await name.fill("A".repeat(201))
  await name.press("Enter")
  await expect(kit.page.locator("[data-sonner-toast]")).toContainText("Unable to make that change.")
}

export default { name: "design-change-refused", design: "/screens/s43-09-editor-tools-design-element", drive }
