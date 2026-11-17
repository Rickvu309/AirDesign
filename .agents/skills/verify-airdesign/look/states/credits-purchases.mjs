import { creditsCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import usagePage from "./usage-page.mjs"

async function drive(kit) {
  await usagePage.drive(kit)
  await kit.page.getByRole("button", { name: creditsCopy.add, exact: true }).click()
  await expect(kit.page.locator("[data-sonner-toast]")).toContainText(creditsCopy.purchases)
}

export default { name: "credits-purchases", design: null, drive }
