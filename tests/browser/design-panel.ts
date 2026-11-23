import { expect, type Locator, type Page } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"

export function picker(page: Page): Locator {
  return page.locator("[data-color-picker]")
}

export async function pickColor(page: Page, field: Locator, name: string): Promise<void> {
  await field.getByRole("button").first().click()
  await picker(page).getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(picker(page)).toHaveCount(0)
  await expect(shownColor(field)).toHaveText(name)
}

export async function typeColor(page: Page, trigger: Locator, hex: string): Promise<void> {
  await trigger.click()
  const menu = picker(page)
  const typed = menu.getByRole("textbox", { name: colorCopy.hex, exact: true })
  if ((await typed.count()) === 0) await menu.getByRole("button", { name: colorCopy.add, exact: true }).click()
  await typed.fill(hex)
  await typed.press("Enter")
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
}

export function shownColor(field: Locator): Locator {
  return field.getByRole("button").first()
}
