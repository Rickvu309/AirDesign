import type { Page } from "@playwright/test"

export async function openScreen(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.locator("#root > *").first().waitFor()
}
