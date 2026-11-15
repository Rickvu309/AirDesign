import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"

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
const slidePart = "ppt/slides/slide1.xml"
const exportName = "exported-color-transforms.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)
const darkTwo = "rgb(31, 58, 95)"
const accentDarker = "rgb(34, 83, 154)"
const darker = { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] }
const written =
  '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill><a:effectLst/></p:bgPr></p:bg>'

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

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function painted(page: Page, color: string): Promise<void> {
  const shown = (selector: string) => page.locator(selector).evaluate((node) => getComputedStyle(node).backgroundColor)
  await expect.poll(() => shown("[data-slide-paint]")).toBe(color)
  await expect.poll(() => shown("[data-slide-entry='1'] [data-thumb-paint]")).toBe(color)
}

async function storeColor(page: Page, color: unknown): Promise<number> {
  return page.evaluate(async (next) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("airdesign")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const changed = await new Promise<number>((resolve, reject) => {
      let count = 0
      const transaction = database.transaction("rows", "readwrite")
      const cursor = transaction.objectStore("rows").openCursor()
      cursor.onsuccess = () => {
        const at = cursor.result
        if (at === null) return
        const row = at.value as { kind?: unknown; node?: unknown; patch?: { fill?: unknown } }
        if (row.kind === "pending" && typeof row.node === "string" && row.node.endsWith(".slide")) {
          at.update({ ...row, patch: { fill: { value: { set: { solid: next } } } } })
          count += 1
        }
        at.continue()
      }
      transaction.oncomplete = () => resolve(count)
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return changed
  }, color)
}

test("a background stored as a theme colour with lumMod paints darker and exports with the slot and transform @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await page.locator("[data-color-picker]").getByRole("button", { name: "Dark 2", exact: true }).click()
  await page.keyboard.press("Escape")
  await painted(page, darkTwo)
  expect(await storeColor(page, darker)).toBe(1)
  await page.reload()
  await settled(page)
  await painted(page, accentDarker)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([slidePart])
  expect(saved.get(slidePart)?.toString("utf8")).toContain(written)
  await copyFile(download, judged)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await painted(page, accentDarker)
})
