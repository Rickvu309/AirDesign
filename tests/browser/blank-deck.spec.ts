import { copyFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Blank deck edits, reloads, exports and imports without an upload, even when created offline", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/")
  await context.setOffline(true)
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const address = page.url()
  const title = page.locator('[contenteditable="true"]').first()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(2)
  await expect(title).toHaveText("")
  await title.click()
  await title.pressSequentially("My first deck", { delay: 50 })
  await expect(title).toHaveText("My first deck")
  await context.setOffline(false)
  await page.reload()
  await expect(page).toHaveURL(address)
  await expect(title).toHaveText("My first deck")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const exported = await download
  expect(exported.suggestedFilename()).toBe("Blank deck.pptx")
  const file = testInfo.outputPath("blank-export.pptx")
  await exported.saveAs(file)
  expect((await readFile(file)).length).toBeGreaterThan(0)
  await copyFile(file, join(process.cwd(), "tests/browser/exported-blank.pptx"))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  expect(page.url()).not.toBe(address)
  await expect(title).toHaveText("My first deck")
})

test("New slide on a blank deck paints layout placeholders and exports", async ({ page }, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(2)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const file = testInfo.outputPath("exported-blank-slides.pptx")
  await (await download).saveAs(file)
  await copyFile(file, join(process.cwd(), "tests/browser/exported-blank-slides.pptx"))
})
