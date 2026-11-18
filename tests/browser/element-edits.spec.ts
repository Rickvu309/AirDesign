import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog.ts"
import { newBlankDeck } from "./new-deck"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test("adds a text box and deletes an element, and both survive a reload, the export and a new import", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(1)
  await expect(texts.first()).toBeFocused()
  await page.keyboard.type("Remove me")
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await expect(texts).toHaveCount(2)
  const added = texts.last()
  await expect(added).toBeFocused()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.type("Added text", { delay: 20 })
  await expect(added).toHaveText("Added text")
  await page.reload()
  await settled(page)
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Added text")
  await texts.first().click()
  await page.keyboard.press("Backspace")
  await expect(texts).toHaveCount(2)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Delete")
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toHaveText("Added text")
  await page.reload()
  await settled(page)
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toHaveText("Added text")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("element-edits.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  expect(xml).toContain("<a:t>Added text</a:t>")
  expect(xml.match(/<p:sp>/g)).toHaveLength(1)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toHaveText("Added text")
})

test("text typed straight after Add text box keeps its first letters", async ({ page }) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const boxes = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(boxes).toHaveCount(0)
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await page.keyboard.type("Typed fast", { delay: 20 })
  await expect(boxes).toHaveCount(1)
  await expect(boxes.last()).toHaveText("Typed fast")
})
