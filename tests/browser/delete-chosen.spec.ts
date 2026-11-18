import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

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
const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
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

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function frame(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function counted(shapes: readonly Locator[], count: number): Promise<void> {
  for (const shape of shapes) await expect(shape).toHaveCount(count)
}

test("Delete takes every chosen shape away as one step, one undo brings them all back, and the export keeps them", async ({
  page,
}, testInfo) => {
  covers("select-add", "delete")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(blank)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  const shapes = [frame(page, 4), frame(page, 5)]
  await counted(shapes, 1)
  await shapes[0]!.click()
  await shapes[1]!.click({ modifiers: ["Shift"] })
  await page.keyboard.press("Delete")
  await counted(shapes, 0)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["delete-element"], exact: true })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+z")
  await counted(shapes, 1)
  await expect(page.getByRole("button", { name: "Undo add shape", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: undoCopy.redoNamed["delete-element"], exact: true })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await counted(shapes, 0)
  await page.keyboard.press("ControlOrMeta+z")
  await counted(shapes, 1)

  await page.reload()
  await settled(page)
  await counted(shapes, 1)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath("deleted-undone.pptx")
  await (await saving).saveAs(download)
  const before = await partsOf(blank)
  const after = await partsOf(download)
  expect([...after.keys()]).toEqual([...before.keys()])
  expect([...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)).toEqual([
    part,
  ])
  const xml = after.get(part)?.toString("utf8") ?? ""
  expect(xml).toContain('<p:cNvPr id="4"')
  expect(xml).toContain('<p:cNvPr id="5"')
})
