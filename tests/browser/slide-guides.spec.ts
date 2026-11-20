import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { guideCopy } from "../../apps/web/src/copy/guide-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { test } from "./deck-test"
import { exportFromDialog } from "./export-dialog"
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

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const exportName = "exported-slide-guides.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/census-updating-spm.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)

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

function lines(page: Page): Promise<readonly string[]> {
  return page
    .locator("[data-guide-line]")
    .evaluateAll((all) => all.map((each) => each.getAttribute("data-guide-line") ?? ""))
}

async function dragged(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

test("a person pulls a guide out of the ruler, moves one back into it, and the export keeps the slide's guides @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("rulers", "guide-add", "guide-duplicate")
  await rm(judged, { force: true })
  await decks.open(fixture)
  await expect(page.locator("[data-canvas-rulers]")).toHaveCount(0)
  await page.keyboard.press("Shift+R")
  await expect(page.locator("[data-canvas-rulers]")).toBeVisible()
  const opened = await lines(page)
  expect(opened).toEqual(["y 270", "x 480", "x 916.6", "x 45.3", "x 40.6", "x 918.6"])

  const top = await page.locator('[data-ruler="x"]').boundingBox()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (top === null || slide === null) throw new Error("ruler")
  await dragged(page, { x: slide.x + 300, y: top.y + 10 }, { x: slide.x + 300, y: slide.y + slide.height * 0.8 })
  await expect(page.locator("[data-guide-line]")).toHaveCount(7)
  const added = (await lines(page)).at(-1) ?? ""
  expect(added).toMatch(/^y /)
  await expect(page.locator("[data-ruler-mark]").filter({ hasText: added.slice(2) })).toHaveCount(1)

  const middle = await page.locator('[data-guide-handle="x 480"]').boundingBox()
  const left = await page.locator('[data-ruler="y"]').boundingBox()
  if (middle === null || left === null) throw new Error("guide")
  const grab = { x: middle.x + middle.width / 2, y: slide.y + slide.height / 2 }
  await dragged(page, grab, { x: left.x + 8, y: grab.y })
  await expect(page.locator('[data-guide-line="x 480"]')).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["delete-guide"], exact: true }).click()
  await expect(page.locator('[data-guide-line="x 480"]')).toHaveCount(1)
  await page.getByRole("button", { name: undoCopy.redoNamed["delete-guide"], exact: true }).click()
  await expect(page.locator('[data-guide-line="x 480"]')).toHaveCount(0)

  const across = await page.locator('[data-guide-handle="y 270"]').boundingBox()
  if (across === null) throw new Error("guide")
  await page.mouse.click(slide.x + 200, across.y + across.height / 2)
  await page.keyboard.press("Delete")
  await expect(page.locator('[data-guide-line="y 270"]')).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["delete-guide"], exact: true }).click()
  await expect(page.locator('[data-guide-line="y 270"]')).toHaveCount(1)

  const copied = await page.locator('[data-guide-handle="y 270"]').boundingBox()
  if (copied === null) throw new Error("guide")
  await page.keyboard.down("AltLeft")
  await dragged(page, { x: slide.x + 200, y: copied.y + copied.height / 2 }, { x: slide.x + 200, y: copied.y + 80 })
  await page.keyboard.up("AltLeft")
  await expect(page.locator("[data-guide-line]")).toHaveCount(7)
  await expect(page.locator('[data-guide-line="y 270"]')).toHaveCount(1)
  await page.getByRole("button", { name: undoCopy.undoNamed["add-guide"], exact: true }).click()
  await expect(page.locator("[data-guide-line]")).toHaveCount(6)

  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemcheckbox", { name: guideCopy.rulers }).click()
  await expect(page.locator("[data-canvas-rulers]")).toHaveCount(0)
  await page.reload()
  await decks.ready()
  await expect(page.locator("[data-canvas-rulers]")).toHaveCount(0)
  await page.keyboard.press("Shift+R")
  const kept = await lines(page)
  expect(kept).toEqual(["y 270", "x 916.6", "x 45.3", "x 40.6", "x 918.6", added])

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const saved = await partsOf(download)
  expect(saved.get("ppt/slides/slide1.xml")?.toString("utf8")).toContain("https://airdesign.app/2026/guides")
  await copyFile(download, judged)
})
