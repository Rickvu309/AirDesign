import { expect, type Page } from "@playwright/test"

export async function exportFromDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
}

export async function savedExport(page: Page, file: string): Promise<string> {
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const got = await download
  await got.saveAs(file)
  return got.suggestedFilename()
}
