import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"
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

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const heatPumps = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")
const groupName = "exported-group.pptx"
const ungroupName = "exported-ungroup.pptx"

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

function frame(page: Page, part: string, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

function near(left: readonly Placed[], right: readonly Placed[], dx = 0): boolean {
  return left.every((box, at) => {
    const other = right[at]
    if (other === undefined) return false
    const sides = [box.x - other.x - dx, box.y - other.y, box.width - other.width, box.height - other.height]
    return sides.every((side) => Math.abs(side) <= 1.5)
  })
}

async function holds(shapes: readonly Locator[], expected: readonly Placed[], dx = 0): Promise<void> {
  await expect.poll(async () => near(await Promise.all(shapes.map(placed)), expected, dx)).toBe(true)
}

function status(page: Page): Locator {
  return page.locator("[data-slide-paint]").getByRole("status")
}

async function changedParts(original: string, saved: string): Promise<string[]> {
  const before = await partsOf(original)
  const after = await partsOf(saved)
  expect([...after.keys()]).toEqual([...before.keys()])
  return [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

test("two shapes group in place, move together, ungroup in place, and the export keeps the group @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("ungroup")
  const part = "ppt/slides/slide1.xml"
  const judged = join(process.cwd(), "tests/browser", groupName)
  await rm(judged, { force: true })
  await decks.open(blank)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  const shapes = [frame(page, part, 4), frame(page, part, 5)]
  await expect(shapes[1]!).toBeVisible()
  const ellipse = await placed(shapes[1]!)
  await page.mouse.move(ellipse.x + ellipse.width / 2, ellipse.y + ellipse.height / 2)
  await page.mouse.down()
  await page.mouse.move(ellipse.x + ellipse.width / 2 + 160, ellipse.y + ellipse.height / 2 + 40, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: "Undo move", exact: true })).toBeEnabled()
  const loose = await Promise.all(shapes.map(placed))
  await shapes[0]!.click()
  await shapes[1]!.click({ modifiers: ["Shift"] })
  const rectangle = await placed(shapes[0]!)
  await page.mouse.click(rectangle.x + 10, rectangle.y + 10, { button: "right" })
  await expect(page.getByRole("menuitem", { name: "Ungroup Ctrl+Shift+G" })).toBeDisabled()
  await page.getByRole("menuitem", { name: "Group Ctrl+G" }).click()
  await expect(status(page)).toHaveText("Grouped")
  await expect(frame(page, part, 6)).toHaveCount(1)
  await holds(shapes, loose)
  const grabbed = await placed(shapes[0]!)
  await page.mouse.move(grabbed.x + grabbed.width / 2, grabbed.y + grabbed.height / 2)
  await page.mouse.down()
  await page.mouse.move(grabbed.x + grabbed.width / 2 + 80, grabbed.y + grabbed.height / 2, { steps: 8 })
  await page.mouse.up()
  await holds(shapes, loose, 80)
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await holds(shapes, loose)
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await holds(shapes, loose, 80)
  const moved = await Promise.all(shapes.map(placed))
  await shapes[1]!.click()
  await page.keyboard.press("Control+Shift+g")
  await expect(status(page)).toHaveText("Ungrouped")
  await expect(frame(page, part, 6)).toHaveCount(0)
  await holds(shapes, moved)
  await page.getByRole("button", { name: "Undo ungroup", exact: true }).click()
  await expect(frame(page, part, 6)).toHaveCount(1)
  await holds(shapes, moved)
  await page.reload()
  await decks.ready()
  await holds(shapes, moved)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(groupName)
  await (await saving).saveAs(download)
  expect(await changedParts(blank, download)).toEqual([part])
  const xml = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  expect(xml).toMatch(/<p:grpSp><p:nvGrpSpPr><p:cNvPr id="6" name="Group 6"\/>/)
  expect(xml.indexOf('<p:cNvPr id="4"')).toBeGreaterThan(xml.indexOf('<p:cNvPr id="6"'))
  await copyFile(download, judged)
  await decks.open(download)
  await expect(frame(page, part, 6)).toHaveCount(1)
  await holds(shapes, moved)
})

test("a file group with its own child frame ungroups with nothing moving, and the export judges clean @export", async ({
  page,
  decks,
}, testInfo) => {
  const part = "ppt/slides/slide8.xml"
  const judged = join(process.cwd(), "tests/browser", ungroupName)
  await rm(judged, { force: true })
  await decks.open(heatPumps)
  await page.locator('[data-slide-entry="8"]').click()
  const children = [7, 9, 16].map((shape) => frame(page, part, shape))
  await expect(children[0]!).toBeVisible()
  const before = await Promise.all(children.map(placed))
  await children[0]!.click({ force: true })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.18$/)
  await page.keyboard.press("Control+Shift+g")
  await expect(status(page)).toHaveText("Ungrouped")
  await expect(frame(page, part, 18)).toHaveCount(0)
  await holds(children, before)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(ungroupName)
  await (await saving).saveAs(download)
  expect(await changedParts(heatPumps, download)).toEqual([part])
  const xml = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  expect(xml).not.toContain('name="Group 17"')
  await copyFile(download, judged)
  await decks.open(download)
  await page.locator('[data-slide-entry="8"]').click()
  await holds(children, before)
})
