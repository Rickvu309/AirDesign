import { expect } from "@playwright/test"
import element from "./design-element.mjs"

async function drive(kit) {
  await element.drive(kit)
  const text = kit.page.locator("[data-design-element] textarea").first()
  await text.fill("Long text ".repeat(900))
  await text.press("ControlOrMeta+Enter")
  await expect(
    kit.page
      .getByText("Use less text. Text and formatting must fit within 8,000 bytes.")
      .or(kit.page.locator("[data-sonner-toast]")),
  ).toBeVisible()
}

export default { name: "design-text-limit", design: "/screens/s43-09-editor-tools-design-element", drive }
