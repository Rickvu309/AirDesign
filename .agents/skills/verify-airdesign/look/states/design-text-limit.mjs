import { expect } from "@playwright/test"
import element from "./design-element.mjs"

async function drive(kit) {
  await element.drive(kit)
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').dblclick()
  await kit.page.keyboard.insertText("Long text ".repeat(900))
  await kit.page.keyboard.press("Escape")
  await expect(
    kit.page
      .getByText("Use less text. This box holds up to 8,000 characters, including formatting.")
      .or(kit.page.locator("[data-sonner-toast]")),
  ).toBeVisible()
}

export default { name: "design-text-limit", design: "/screens/s43-09-editor-tools-design-element", drive }
