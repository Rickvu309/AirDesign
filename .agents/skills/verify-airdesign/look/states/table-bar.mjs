import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("group", { name: "New deck" }).getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Tab")
  await page.keyboard.type("Sales")
  await expect(page.getByRole("toolbar", { name: "Table rows" })).toBeVisible()
}

export default { name: "table-bar", design: editor, drive }
