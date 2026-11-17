import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { shapeExportName, shapeOriginalName, shapeSlidePart } from "../../scripts/shape-export.mjs"
import { exportFromDialog } from "./export-dialog"
import { importTitleDeck } from "./new-deck"

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
const fixture = join(process.cwd(), "scripts/pptx-fixtures", shapeOriginalName)
const judged = join(process.cwd(), "tests/browser", shapeExportName)

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

function frame(page: Page, shape: number) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${shapeSlidePart}#${String(shape)}"]`)
}

function painted(page: Page, shape: number) {
  return frame(page, shape).locator("[data-canvas-line]")
}

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

async function clickLine(page: Page, shape: number): Promise<void> {
  const line = await painted(page, shape).boundingBox()
  if (line === null) throw new Error("no line")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
}

test("the Shapes tray has every shape on, and More shapes opens a grid of every preset a keyboard can pick", async ({
  page,
}) => {
  await page.goto("/")
  await importTitleDeck(page)
  await settled(page)
  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  const tray = page.locator("[data-shape-tray]")
  await expect(tray).toBeVisible()
  await expect(tray.getByRole("button")).toHaveCount(12)
  await expect(tray.locator("button:disabled")).toHaveCount(0)
  await tray.getByRole("button", { name: "More shapes", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(tray).toHaveCount(0)
  const grid = page.locator("[data-shape-grid]")
  await expect(grid).toBeVisible()
  await expect.poll(() => grid.getByRole("button").count()).toBeGreaterThan(40)
  await expect(grid.locator("button:disabled")).toHaveCount(0)
  await grid.getByRole("button", { name: "Hexagon", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(grid).toHaveCount(0)
  await expect(painted(page, 4)).toBeVisible()
  await expect(page.locator("[data-slide-paint] [data-canvas-element] svg path").first()).toHaveAttribute("d", /L/)
  await page.getByRole("button", { name: "Undo add shape", exact: true }).click()
  await expect(painted(page, 4)).toHaveCount(0)
})

test("a star, a triangle and an arrow are inserted, undone, redone and kept through a reload", async ({ page }) => {
  await page.goto("/")
  await importTitleDeck(page)
  await settled(page)
  await insert(page, "Star")
  await insert(page, "Triangle")
  await insert(page, "Arrow")
  for (const shape of [4, 5, 6]) await expect(painted(page, shape)).toBeVisible()
  await page.getByRole("button", { name: "Undo add shape", exact: true }).click()
  await expect(painted(page, 6)).toHaveCount(0)
  await page.getByRole("button", { name: "Redo add shape", exact: true }).click()
  await expect(painted(page, 6)).toBeVisible()
  await page.reload()
  await settled(page)
  for (const shape of [4, 5, 6]) await expect(painted(page, shape)).toBeVisible()
})

test("a rectangle, an ellipse, a line, a star, a triangle and an arrow are inserted, moved, resized, deleted and undone, and export with only their slide changed @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await insert(page, "Rectangle")
  await expect(frame(page, 4)).toHaveAttribute("aria-label", "Shape")
  await insert(page, "Ellipse")
  await insert(page, "Line")
  await insert(page, "Star")
  await insert(page, "Triangle")
  await insert(page, "Arrow")
  for (const shape of [4, 5, 6, 7, 8, 9]) await expect(painted(page, shape)).toBeVisible()
  await expect(frame(page, 6)).toHaveAttribute("aria-label", "Line")
  const placed = await frame(page, 4).boundingBox()
  if (placed === null) throw new Error("no rectangle")
  await frame(page, 4).click()
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => (await frame(page, 4).boundingBox())?.x ?? 0).toBeGreaterThan(placed.x + 5)
  await page.keyboard.press("Alt+Shift+ArrowDown")
  await expect.poll(async () => (await frame(page, 4).boundingBox())?.height ?? 0).toBeGreaterThan(placed.height)
  await expect(page.getByRole("button", { name: "Undo resize", exact: true })).toBeEnabled()
  await clickLine(page, 9)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.press("Delete")
  await expect(painted(page, 9)).toHaveCount(0)
  await page.getByRole("button", { name: "Undo delete element", exact: true }).click()
  await expect(painted(page, 9)).toBeVisible()
  await page.getByRole("button", { name: "Redo delete element", exact: true }).click()
  await expect(painted(page, 9)).toHaveCount(0)
  await page.getByRole("button", { name: "Undo delete element", exact: true }).click()
  await expect(painted(page, 9)).toBeVisible()
  await page.reload()
  await settled(page)
  for (const shape of [4, 5, 6, 7, 8, 9]) await expect(painted(page, shape)).toBeVisible()
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(shapeExportName)
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([shapeSlidePart])
  const xml = saved.get(shapeSlidePart)?.toString("utf8") ?? ""
  const added = xml.slice(xml.indexOf('<p:cNvPr id="4"'))
  expect([...added.matchAll(/<a:prstGeom prst="([A-Za-z0-9]+)">/g)].map((found) => found[1])).toEqual([
    "rect",
    "ellipse",
    "line",
    "star5",
    "triangle",
    "straightConnector1",
  ])
  expect(xml.match(/<p:cxnSp>/g)).toHaveLength(2)
  expect(xml.match(/<a:tailEnd type="triangle"\/>/g)).toHaveLength(1)
  await copyFile(download, judged)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await settled(page)
  for (const shape of [4, 5, 6, 7, 8, 9]) await expect(painted(page, shape)).toBeVisible()
})

test("Undo takes back an inserted shape and Redo brings it back, through a reload", async ({ page }) => {
  await page.goto("/")
  await importTitleDeck(page)
  await settled(page)
  await insert(page, "Ellipse")
  await expect(painted(page, 4)).toBeVisible()
  await page.getByRole("button", { name: "Undo add shape", exact: true }).click()
  await expect(painted(page, 4)).toHaveCount(0)
  await page.getByRole("button", { name: "Redo add shape", exact: true }).click()
  await expect(painted(page, 4)).toBeVisible()
  await page.reload()
  await settled(page)
  await expect(painted(page, 4)).toBeVisible()
})
