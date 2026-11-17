import { expect } from "@playwright/test"
import usagePage from "./usage-page.mjs"

async function drive(kit) {
  await usagePage.drive(kit)
  await kit.page.getByRole("button", { name: "Add credits", exact: true }).click()
  await expect(kit.page.locator("[data-sonner-toast]")).toContainText("Adding credits isn’t available yet.")
}

export default { name: "credits-purchases", design: null, drive }
