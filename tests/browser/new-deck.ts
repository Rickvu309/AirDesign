import type { Page } from "@playwright/test"

export async function newBlankDeck(page: Page): Promise<void> {
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("menu", { name: "New deck" }).getByRole("menuitem", { name: "Blank deck", exact: true }).click()
}
