import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
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
const exportName = "exported-frame-fill.pptx"
const part = "ppt/slides/slide1.xml"

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

async function choose(page: Page, menu: Locator, option: string): Promise<void> {
  await menu.click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a layer in an auto layout frame fills its free width and its height, through Undo, the export and a new import @export", async ({
  page,
}, testInfo) => {
  covers("auto-layout")
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  const [fill, square, oval] = [painted(page, 3), painted(page, 4), painted(page, 5)]
  await oval.click()
  const panel = page.locator("[data-design-panel]")
  const frameWidth = panel.getByRole("combobox", { name: frameCopy.width, exact: true })
  await choose(page, frameWidth, layoutWords["width.fixed"])
  await expect(frameWidth).toContainText(sizingShown["width.fixed"])
  const grip = await boxOf(page.locator("[data-selection] [data-grip='right']"))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 160, grip.y + grip.height / 2, { steps: 12 })
  await page.mouse.up()
  const frame = await boxOf(fill)
  const [squareAt, ovalAt] = await Promise.all([square, oval].map(boxOf))

  await oval.dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await expect(panel.getByText(frameCopy.resizing, { exact: true })).toBeVisible()
  const width = panel.getByRole("combobox", { name: frameCopy.width, exact: true })
  const height = panel.getByRole("combobox", { name: frameCopy.height, exact: true })
  await expect(width).toContainText(sizingShown["width.fixed"])
  await choose(page, width, layoutWords["width.fill"])
  await expect(width).toContainText(sizingShown["width.fill"])
  await expect
    .poll(async () => near((await boxOf(oval)).x + (await boxOf(oval)).width, frame.x + frame.width))
    .toBe(true)
  expect(near((await boxOf(oval)).x, ovalAt.x)).toBe(true)
  expect(near((await boxOf(square)).width, squareAt.width)).toBe(true)
  await choose(page, height, layoutWords["height.fill"])
  await expect.poll(async () => near((await boxOf(oval)).height, frame.height)).toBe(true)

  await page.getByRole("button", { name: undoCopy.undoNamed["auto-layout"], exact: true }).click()
  await expect.poll(async () => near((await boxOf(oval)).height, ovalAt.height)).toBe(true)
  await page.getByRole("button", { name: undoCopy.redoNamed["auto-layout"], exact: true }).click()
  await expect.poll(async () => near((await boxOf(oval)).height, frame.height)).toBe(true)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const before = await partsOf(original)
  const after = await partsOf(download)
  const changed = [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed.sort()).toEqual([part, "ppt/tags/tag1.xml"].sort())
  expect(after.get("ppt/tags/tag1.xml")?.toString("utf8")).toContain(";l=5:wh;")
  await copyFile(download, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await expect.poll(async () => near((await boxOf(painted(page, 5))).height, frame.height)).toBe(true)
  await painted(page, 5).click()
  await painted(page, 5).dblclick()
  await expect(
    page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.width, exact: true }),
  ).toContainText(sizingShown["width.fill"])
})
