import { join } from "node:path"
import { expect, type Page } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

export async function openFixture(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page[data-deck-ready]")).toBeVisible()
  await expect(page.getByRole("button", { name: "Rename deck: clean" })).toBeVisible()
}
