import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { frameCopy, layoutWords, sizingShown } from "../../apps/web/src/copy/frame-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { exportFromDialog } from "./export-dialog"
import { openDeck, setPanelMode } from "./design-panel"
import { covers } from "./gesture"

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

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const original = join(process.cwd(), "scripts/pptx-fixtures/frame.pptx")
const exportName = "exported-frame-sized.pptx"
const part = "ppt/slides/slide1.xml"
const grown = 160

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function boxOf(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1.5
}

async function frameSelected(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await painted(page, 4).click()
  return page.locator("[data-design-panel]")
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("dragging a side of a hugging auto layout frame makes that side Fixed, Alignment places the row along it, and the export keeps it @export", async ({
  page,
}, testInfo) => {
  covers("resize", "auto-layout")
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  await openDeck(page, "frame.pptx")
  const panel = await frameSelected(page)
  const width = panel.getByRole("combobox", { name: frameCopy.width, exact: true })
  const height = panel.getByRole("combobox", { name: frameCopy.height, exact: true })
  await expect(width).toContainText(sizingShown["width.hug"])
  await expect(height).toContainText(sizingShown["height.hug"])
  const [fill, square, oval] = [painted(page, 3), painted(page, 4), painted(page, 5)]
  const [hugged, squareAt, ovalAt] = await Promise.all([fill, square, oval].map(boxOf))

  const grip = await boxOf(page.locator("[data-selection] [data-grip='right']"))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + grown, grip.y + grip.height / 2, { steps: 12 })
  await expect.poll(async () => near((await boxOf(fill)).width, hugged.width + grown)).toBe(true)
  expect(near((await boxOf(square)).width, squareAt.width)).toBe(true)
  await page.mouse.up()
  await expect(width).toContainText(sizingShown["width.fixed"])
  await expect(height).toContainText(sizingShown["height.hug"])
  await expect.poll(async () => near((await boxOf(fill)).width, hugged.width + grown)).toBe(true)
  expect(near((await boxOf(square)).x, squareAt.x)).toBe(true)

  await panel.getByRole("button", { name: layoutWords["layout.align.top"], exact: true }).click()
  await expect.poll(async () => near((await boxOf(square)).x, squareAt.x + grown / 2)).toBe(true)
  expect(near((await boxOf(oval)).x, ovalAt.x + grown / 2)).toBe(true)

  await page.getByRole("button", { name: undoCopy.undoNamed["auto-layout"], exact: true }).click()
  await expect.poll(async () => near((await boxOf(square)).x, squareAt.x)).toBe(true)
  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(async () => near((await boxOf(fill)).width, hugged.width)).toBe(true)
  await expect(width).toContainText(sizingShown["width.hug"])
  await page.getByRole("button", { name: undoCopy.redoNamed.resize, exact: true }).click()
  await expect(width).toContainText(sizingShown["width.fixed"])
  await page.getByRole("button", { name: undoCopy.redoNamed["auto-layout"], exact: true }).click()
  await expect.poll(async () => near((await boxOf(square)).x, squareAt.x + grown / 2)).toBe(true)

  await height.click()
  await page.getByRole("option", { name: layoutWords["height.fixed"], exact: true }).click()
  await expect(height).toContainText(sizingShown["height.fixed"])
  expect(near((await boxOf(fill)).height, hugged.height)).toBe(true)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const before = await partsOf(original)
  const after = await partsOf(download)
  const changed = [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed.sort()).toEqual([part, "ppt/tags/tag1.xml"].sort())
  expect([...after.keys()].filter((name) => !before.has(name))).toEqual([])
  expect(after.get("ppt/tags/tag1.xml")?.toString("utf8")).toContain(";a=top;w=f;h=f;")
  await copyFile(download, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const reopened = await frameSelected(page)
  await expect(reopened.getByRole("combobox", { name: frameCopy.width, exact: true })).toContainText(
    sizingShown["width.fixed"],
  )
  await expect(reopened.getByRole("combobox", { name: frameCopy.height, exact: true })).toContainText(
    sizingShown["height.fixed"],
  )
  await expect.poll(async () => near((await boxOf(painted(page, 3))).width, hugged.width + grown)).toBe(true)
})
