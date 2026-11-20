import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { diagramEditsExportName, diagramEditsOriginalName } from "../../scripts/diagram-edits.mjs"
import { stored } from "./device-store"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"
const original = join(process.cwd(), "scripts/pptx-fixtures", diagramEditsOriginalName)
const slidePart = "ppt/slides/slide5.xml"
const frameKey = `${slidePart}#6`
const titleKey = `${slidePart}#34`
const edited = "Timeline after an edit"

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

async function partsOf(file: string): Promise<Map<string, Uint8Array>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Uint8Array>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, await entry.getData(new zip.Uint8ArrayWriter()))
  }
  await reader.close()
  return parts
}

function text(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return new TextDecoder().decode(bytes)
}

function diagramFrame(xml: string): string {
  const start = xml.lastIndexOf("<p:graphicFrame>", xml.indexOf("dgm:relIds"))
  const end = xml.indexOf("</p:graphicFrame>", start)
  if (start < 0 || end < 0) throw new Error("frame")
  return xml.slice(start, end + "</p:graphicFrame>".length)
}

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

test("a diagram paints its saved shapes and words, offers nothing to edit, and exports byte for byte after an edit and a duplicate @export", async ({
  page,
  decks,
}, testInfo) => {
  await decks.open(original)
  await entry(page, 5).click()
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")
  const frame = page.locator(`[data-slide-paint] [data-canvas-element="${frameKey}"]`)
  await expect(frame.locator("[data-diagram-shape]")).toHaveCount(6)
  await expect(frame).toContainText("2023")
  await expect(frame).toContainText("2025")
  await expect(frame.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(entry(page, 5).locator("[data-diagram-shape]")).toHaveCount(6)
  const title = page.locator(`[data-slide-paint] [data-canvas-element="${titleKey}"] [contenteditable="true"]`)
  await title.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await title.pressSequentially(edited, { delay: 20 })
  await expect(title).toHaveText(edited)
  await stored(page, edited)
  await page.keyboard.press("Escape")
  await entry(page, 5).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 6)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-diagram-shape]")).toHaveCount(6)
  await expect(page.locator("[data-slide-paint]")).toContainText("2024")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(diagramEditsExportName)
  await (await saving).saveAs(file)
  const before = await partsOf(original)
  const after = await partsOf(file)
  const diagramParts = [...before.keys()].filter((name) => name.startsWith("ppt/diagrams/"))
  expect(diagramParts.length).toBeGreaterThan(0)
  for (const name of diagramParts) expect(after.get(name), name).toEqual(before.get(name))
  const frameBytes = diagramFrame(text(before, slidePart))
  expect(text(after, slidePart)).toContain(edited)
  expect(diagramFrame(text(after, slidePart))).toBe(frameBytes)
  const added = [...after.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name) && !before.has(name))
  expect(added).toHaveLength(1)
  const copy = added[0] ?? ""
  expect(diagramFrame(text(after, copy))).toBe(frameBytes)
  await copyFile(file, join(process.cwd(), "tests/browser", diagramEditsExportName))
})
