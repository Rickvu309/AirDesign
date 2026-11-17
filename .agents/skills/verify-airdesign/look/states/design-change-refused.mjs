import { expect } from "@playwright/test"
import element from "./design-element.mjs"

async function drive(kit) {
  await element.drive(kit)
  const text = kit.page.locator('[data-design-element] textarea').first()
  await text.fill("Long text ".repeat(900))
  await text.press("ControlOrMeta+Enter")
  await expect(kit.page.locator("[data-sonner-toast]")).toContainText("Unable to make that change.")
}

export default { name: "design-change-refused", design: "/screens/s43-09-editor-tools-design-element", drive }
