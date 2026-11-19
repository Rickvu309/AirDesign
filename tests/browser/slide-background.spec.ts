import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { colorWords } from "./color-words"
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
const exportName = "exported-slide-background.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)
const white = "rgb(255, 255, 255)"
const darkTwo = "rgb(31, 58, 95)"
const written =
  '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="dk2"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'

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

function background(page: Page) {
  return page.locator("[data-design-panel]").getByRole("button", { name: /^Background color/ })
}

async function pick(page: Page, name: string) {
  await background(page).click()
  await page.locator("[data-color-picker]").getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Escape")
}

test("a person sets a slide's background colour, undoes and redoes it, and the export writes only that slide @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await painted(page, white)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText("Slide 1", { exact: true })).toBeVisible()
  const names = await colorWords("blank.pptx")
  await expect(background(page)).toHaveText(names.lt1)
  await expect(panel.locator("[data-template-style]")).toBeVisible()
  await expect(panel.getByRole("button", { name: /^Picture/ })).toHaveCount(0)
  await pick(page, names.dk2)
  await painted(page, darkTwo)
  await expect(background(page)).toHaveText(names.dk2)
  await page.getByRole("button", { name: "Undo background color", exact: true }).click()
  await painted(page, white)
  await expect(background(page)).toHaveText(names.lt1)
  await page.getByRole("button", { name: "Redo background color", exact: true }).click()
  await painted(page, darkTwo)
  await page.reload()
  await settled(page)
  await painted(page, darkTwo)
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
  await painted(page, darkTwo)
})
