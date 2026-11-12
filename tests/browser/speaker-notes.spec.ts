import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
const typed = "Remember the result & the next step.\nThank everyone."

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => {
    getEntries(): Promise<ZipEntry[]>
    close(): Promise<void>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
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

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function openNotes(page: Page) {
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  return page.getByRole("textbox", { name: "Speaker notes", exact: true })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a speaker note typed in the bar survives a reload and changes only its notes part in the export", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  let field = await openNotes(page)
  await expect(field).toBeEditable()
  await field.fill(typed)
  await page.reload()
  await settled(page)
  field = await openNotes(page)
  await expect(field).toHaveValue(typed)
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const download = testInfo.outputPath("exported-notes.pptx")
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed).toHaveLength(1)
  expect(changed[0]).toMatch(/^ppt\/notesSlides\/notesSlide\d+\.xml$/)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  field = await openNotes(page)
  await expect(field).toHaveValue(typed)
})

test("a slide with no notes part shows the bar read-only with a hint", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.locator('[data-slide-entry="2"]').click()
  const field = await openNotes(page)
  await expect(field).not.toBeEditable()
  await expect(page.getByText("Speaker notes can't be edited on this slide yet.").first()).toBeVisible()
})
