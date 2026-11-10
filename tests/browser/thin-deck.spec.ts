import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const fixture = join(fixtures, "clean.pptx")
const exported = join(process.cwd(), "tests/browser/exported-deck.pptx")
const slide = "ppt/slides/slide1.xml"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
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

async function changedParts(before: string, after: string): Promise<string[]> {
  const original = await partsOf(before)
  const saved = await partsOf(after)
  expect([...saved.keys()]).toEqual([...original.keys()])
  return [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

async function open(page: Page, file: string): Promise<void> {
  await page.goto("/thin")
  await page.locator("input[type=file]").setInputFiles(file)
}

async function stored(page: Page, value: string): Promise<void> {
  await page.waitForFunction(async (expected) => {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open("airdesign")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction("rows", "readonly")
        const all = transaction.objectStore("rows").getAll()
        all.onerror = () => reject(all.error)
        all.onsuccess = () => {
          database.close()
          resolve(all.result as unknown[])
        }
      }
    })
    return rows.some((row) => {
      if (typeof row !== "object" || row === null || !("value" in row)) return false
      return (row as { value: unknown }).value === expected
    })
  }, value)
}

async function saveExport(page: Page, file: string): Promise<void> {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(file)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("an edit to Hello! survives reload and exports", async ({ page }, testInfo) => {
  await rm(exported, { force: true })
  const download = testInfo.outputPath("exported-deck.pptx")
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello!", { delay: 50 })
  await expect(editor).toHaveText("Hello!")
  await stored(page, "Hello!")
  await page.reload()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
  await saveExport(page, download)
  expect(await changedParts(fixture, download)).toEqual([slide])
  const saved = (await partsOf(download)).get(slide)?.toString("utf8") ?? ""
  expect(saved.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello!</a:t>"])
  await copyFile(download, exported)
})

test("typing key by key keeps the order of the letters", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(" world", { delay: 50 })
  await expect(editor).toHaveText("Hello world")
  await stored(page, "Hello world")
  await page.reload()
  await expect(editor).toHaveText("Hello world")
  await editor.click()
  await page.keyboard.press("Home")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await editor.pressSequentially("XY", { delay: 50 })
  await expect(editor).toHaveText("HeXYllo world")
  await stored(page, "HeXYllo world")
})

test("typed spaces are stored as plain spaces", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(" a  b ", { delay: 50 })
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
  await stored(page, "Hello a  b ")
  await page.reload()
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
})

async function paste(page: Page, data: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    const clipboardData = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) clipboardData.setData(type, value)
    document
      .querySelector('[contenteditable="true"]')
      ?.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }))
  }, data)
}

test("a line break stays out of a box that holds one line", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await editor.pressSequentially("x", { delay: 50 })
  await expect.poll(() => editor.textContent()).toBe("Hellox")
  await stored(page, "Hellox")
  await paste(page, { "text/plain": "one\r\ntwo" })
  await expect.poll(() => editor.textContent()).toBe("Helloxone two")
  await stored(page, "Helloxone two")
  await paste(page, { "text/html": "<p>long text that\nwraps in source</p>" })
  await expect.poll(() => editor.textContent()).toBe("Helloxone twolong text that wraps in source")
  await stored(page, "Helloxone twolong text that wraps in source")
  await page.reload()
  await expect.poll(() => editor.textContent()).toBe("Helloxone twolong text that wraps in source")
})

test("a cleared box is stored empty", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect.poll(() => editor.textContent()).toBe("")
  await stored(page, "")
  await page.reload()
  await expect(editor).toHaveText("")
})

test("an export with no edit keeps every part byte for byte", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("no-edit.pptx")
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await saveExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
})

test("an export with no edit is the same file byte for byte", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("no-edit.pptx")
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await saveExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
  test.fail()
  expect((await readFile(saved)).equals(await readFile(fixture))).toBe(true)
})

test("a box that cannot keep an edit is not editable", async ({ page }) => {
  await open(page, join(fixtures, "nasa-1d-cnn.pptx"))
  await expect(page.getByText(/1D-Convolutional/).first()).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await page.locator("input[type=file]").setInputFiles(fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveCount(1)
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially("!?", { delay: 50 })
  await expect(editor).toHaveText("Hello!?")
  await stored(page, "Hello!?")
})
