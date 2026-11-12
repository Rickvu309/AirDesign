import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

type ZipLibrary = {
  ZipReader: new (reader: unknown) => {
    getEntries(): Promise<{ directory: boolean; filename: string; getData(writer: unknown): Promise<Uint8Array> }[]>
    close(): Promise<void>
  }
  Uint8ArrayReader: new (data: Uint8Array) => unknown
  Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

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

test("Blank deck subtitle prompt shows, typing replaces it, deleting brings it back, thumbnail and export omit it", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const prompt = page.locator("[data-slide-paint] [data-placeholder-prompt='Add a subtitle']")
  await expect(prompt).toBeVisible()
  const subtitle = page.locator('[contenteditable="true"]').nth(1)
  await subtitle.click()
  await subtitle.pressSequentially("My subtitle", { delay: 50 })
  await expect(prompt).not.toBeVisible()
  await expect(subtitle).toHaveText("My subtitle")
  for (let step = 0; step < "My subtitle".length; step += 1) await subtitle.press("Backspace")
  await expect(subtitle).toHaveText("")
  await expect(prompt).toBeVisible()
  await expect(page.locator("[data-thumb-paint] [data-placeholder-prompt]")).toHaveCount(0)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const exported = await download
  const file = testInfo.outputPath("prompt-blank-export.pptx")
  await exported.saveAs(file)
  const parts = await partsOf(file)
  for (const [name, buffer] of parts) {
    if (name.startsWith("ppt/slides/")) {
      const xml = buffer.toString("utf8")
      expect(xml).not.toContain("Add a subtitle")
      expect(xml).not.toContain("Add a title")
    }
  }
})
