import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { elementCopy } from "../../apps/web/src/copy/element-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

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
const nested = join(process.cwd(), "scripts/pptx-fixtures/nested-groups.pptx")
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

function layer(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

const inGroup = [2, 3, 4, 5, 6]

async function shown(page: Page, shapes: readonly number[], count: number): Promise<void> {
  for (const shape of shapes) await expect(layer(page, shape)).toHaveCount(count)
}

test("Delete on a group removes it with every layer inside, a refusal closes by itself, Undo brings them back, and the export drops the group", async ({
  page,
  decks,
}, testInfo) => {
  await decks.open(nested)
  await shown(page, [...inGroup, 7], 1)
  await layer(page, 4).click()
  await layer(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await page.keyboard.press("Delete")
  const refusal = page.getByText(elementCopy.removeRefusedTitle)
  await expect(refusal).toBeVisible()
  await expect(refusal).toHaveCount(0, { timeout: 6000 })
  await shown(page, [...inGroup, 7], 1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await layer(page, 4).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.press("Delete")
  await shown(page, inGroup, 0)
  await shown(page, [7], 1)
  await expect(page.getByText(elementCopy.removeRefusedTitle)).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["delete-element"], exact: true }).click()
  await shown(page, [...inGroup, 7], 1)
  await page.getByRole("button", { name: undoCopy.redoNamed["delete-element"], exact: true }).click()
  await shown(page, inGroup, 0)
  await page.reload()
  await decks.ready()
  await shown(page, inGroup, 0)
  await shown(page, [7], 1)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath("exported-group-delete.pptx")
  await (await saving).saveAs(download)
  const before = await partsOf(nested)
  const after = await partsOf(download)
  expect([...after.keys()]).toEqual([...before.keys()])
  const changed = [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed).toEqual([part])
  const xml = after.get(part)?.toString("utf8") ?? ""
  expect(xml).not.toContain("<p:grpSp>")
  for (const shape of inGroup) expect(xml).not.toContain(`<p:cNvPr id="${String(shape)}"`)
  expect(xml).toContain('<p:cNvPr id="7"')
})
