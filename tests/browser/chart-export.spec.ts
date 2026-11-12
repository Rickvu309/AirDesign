import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { chartEditsExportName, chartEditsOriginalName, chartFrames } from "../../scripts/chart-edits.mjs"
import { stored } from "./device-store"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"
const original = join(process.cwd(), "scripts/pptx-fixtures", chartEditsOriginalName)
const slidePart = "ppt/slides/slide19.xml"
const titleKey = `${slidePart}#4`
const tenureKey = `${slidePart}#11`
const edited = "Who the change reaches"

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

function bytesOf(parts: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return bytes
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

test("a chart paints its title and labels, offers nothing to edit, and exports byte for byte after an edit and a duplicate @export", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(original)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await entry(page, 19).click()
  await expect(entry(page, 19)).toHaveAttribute("aria-current", "true")
  const tenure = page.locator(`[data-slide-paint] [data-canvas-element="${tenureKey}"]`)
  await expect(page.locator("[data-slide-paint] svg[data-chart=pie]")).toHaveCount(3)
  await expect(tenure.locator('[data-chart-text="title"]')).toHaveText("Housing Tenure Status")
  await expect(tenure.locator('[data-chart-text="label 0 2"]')).toHaveText("Renter; 60%")
  await expect(tenure.getByRole("img", { name: "Pie chart: Housing Tenure Status" })).toBeVisible()
  await expect(tenure.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(entry(page, 19).locator("svg[data-chart=pie]")).toHaveCount(3)
  const title = page.locator(`[data-slide-paint] [data-canvas-element="${titleKey}"] [contenteditable="true"]`)
  await title.click()
  await page.keyboard.press("ControlOrMeta+a")
  await title.pressSequentially(edited, { delay: 20 })
  await expect(title).toHaveText(edited)
  await stored(page, edited)
  await page.keyboard.press("Escape")
  await entry(page, 19).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 20)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] svg[data-chart=pie]")).toHaveCount(3)
  await expect(page.locator("[data-slide-paint]")).toContainText("Owner with")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const file = testInfo.outputPath(chartEditsExportName)
  await (await saving).saveAs(file)
  const before = await partsOf(original)
  const after = await partsOf(file)
  const chartParts = [...before.keys()].filter(
    (name) => name.startsWith("ppt/charts/") || name.startsWith("ppt/embeddings/"),
  )
  expect(chartParts.length).toBeGreaterThan(0)
  for (const name of chartParts) expect(after.get(name), name).toEqual(before.get(name))
  const frames = chartFrames(bytesOf(before, slidePart))
  expect(frames).toHaveLength(3)
  expect(new TextDecoder().decode(bytesOf(after, slidePart))).toContain(edited)
  expect(chartFrames(bytesOf(after, slidePart))).toEqual(frames)
  const added = [...after.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name) && !before.has(name))
  expect(added).toHaveLength(1)
  const copy = added[0] ?? ""
  expect(chartFrames(bytesOf(after, copy))).toEqual(frames)
  await copyFile(file, join(process.cwd(), "tests/browser", chartEditsExportName))
})
