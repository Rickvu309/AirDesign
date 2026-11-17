import { expect } from "@playwright/test"
import { importTitleDeck } from "../../bin/new-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await importTitleDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  for (const name of ["Line", "Rectangle"]) {
    await kit.page.getByRole("button", { name: "Shapes", exact: true }).click()
    await kit.page.getByRole("button", { name, exact: true }).click()
  }
  await expect(kit.page.locator('[data-slide-paint] [data-canvas-element$="#5"]')).toBeVisible()
  await expect(kit.page.locator("[data-slide-paint] [data-canvas-line]").first()).toBeVisible()
}

export default { name: "shape-after-line", design: null, drive }
