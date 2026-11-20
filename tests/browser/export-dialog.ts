import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"

export async function exportFromDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
}

export async function exportDialogClosed(page: Page): Promise<void> {
  const exportWord = shortcutCopy.gestures.export
  await expect(page.getByRole("dialog", { name: exportWord })).toHaveCount(0)
  await expect(page.getByRole("button", { name: exportWord, exact: true })).toBeFocused()
}

export async function savedExport(page: Page, file: string): Promise<string> {
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const got = await download
  await got.saveAs(file)
  return got.suggestedFilename()
}
