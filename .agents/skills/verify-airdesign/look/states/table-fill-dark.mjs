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
  await table.locator('[data-table-text="1.0"]').click()
  await page.keyboard.type("North")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("textbox", { name: "Row 2, column 1" }).focus()
  await panel.getByRole("group", { name: "Apply to", exact: true }).getByRole("button", { name: "Row" }).click()
  await panel.getByRole("group", { name: "Cell fill", exact: true }).getByRole("button", { name: "Color" }).click()
  await panel.getByRole("group", { name: "Color", exact: true }).first().getByRole("button").first().click()
  await page.locator("[data-color-picker]").getByRole("button", { name: "Dark 2", exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Undo cell fill", exact: true })).toBeEnabled()
}

export default { name: "table-fill-dark", design: editor, drive }
