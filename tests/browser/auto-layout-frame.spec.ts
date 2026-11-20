import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { frameCopy } from "../../apps/web/src/copy/frame-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"
import { decksOn, test } from "./deck-test"

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
const frameName = "exported-frame.pptx"

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

function near(left: readonly Placed[], right: readonly Placed[]): boolean {
  return left.every((box, at) => {
    const other = right[at]
    if (other === undefined) return false
    const sides = [box.x - other.x, box.y - other.y, box.width - other.width, box.height - other.height]
    return sides.every((side) => Math.abs(side) <= 1.5)
  })
}

async function holds(shapes: readonly Locator[], expected: readonly Placed[]): Promise<void> {
  await expect.poll(async () => near(await Promise.all(shapes.map(placed)), expected)).toBe(true)
}

function status(page: Page): Locator {
  return page.locator("[data-slide-paint]").getByRole("status")
}

async function changedParts(original: string, saved: string): Promise<string[]> {
  const before = await partsOf(original)
  const after = await partsOf(saved)
  expect([...after.keys()].filter((name) => !before.has(name))).toEqual(["ppt/tags/tag1.xml"])
  return [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

test("two shapes wrap in an auto layout frame with a filled backdrop, and the export keeps the frame @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("auto-layout")
  const part = "ppt/slides/slide1.xml"
  const judged = join(process.cwd(), "tests/browser", frameName)
  await rm(judged, { force: true })
  await decks.open(blank)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle]) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  const shapes = [frame(page, part, 4), frame(page, part, 5)]
  await expect(shapes[1]!).toBeVisible()
  const ellipse = await placed(shapes[1]!)
  const square = await placed(shapes[0]!)
  await page.mouse.move(ellipse.x + ellipse.width / 2, ellipse.y + ellipse.height / 2)
  await page.mouse.down()
  await page.mouse.move(square.x + square.width / 2 + 260, square.y + square.height / 2 + 12, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  await shapes[0]!.click()
  await shapes[1]!.click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+A")
  await expect(status(page)).toHaveText(groupCopy.said.frame)
  await expect(frame(page, part, 7)).toHaveCount(1)
  const [left, right] = await Promise.all(shapes.map(placed))
  expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 1)
  expect(Math.abs(right!.y - left!.y)).toBeLessThanOrEqual(1.5)
  const laid = [left!, right!]
  const panel = page.locator("[data-design-panel]")
  await panel.getByRole("group", { name: fillCopy.section }).getByRole("button", { name: fillWords.solid }).click()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true })).toBeEnabled()
  await holds(shapes, laid)
  await page.reload()
  await decks.ready()
  await holds(shapes, laid)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(frameName)
  await (await saving).saveAs(download)
  expect((await changedParts(blank, download)).sort()).toEqual(
    ["[Content_Types].xml", part, "ppt/slides/_rels/slide1.xml.rels"].sort(),
  )
  expect((await partsOf(download)).get("ppt/tags/tag1.xml")?.toString("utf8")).toContain('name="AIRDESIGN_LAYOUT"')
  const xml = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  expect(xml).toMatch(/<p:grpSp><p:nvGrpSpPr><p:cNvPr id="6" name="Frame 6"\/>/)
  expect(xml.indexOf('<p:cNvPr id="7" name="Backdrop 7"/>')).toBeLessThan(xml.indexOf('<p:cNvPr id="4"'))
  await copyFile(download, judged)
  await decks.open(download)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(frame(page, part, 6)).toHaveCount(1)
  await holds(shapes, laid)
  await shapes[0]!.click()
  await expect(page.locator("[data-design-panel]").getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
})

async function wrappedPair(page: Page, part: string): Promise<readonly Locator[]> {
  await decksOn(page).open(blank)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle]) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  const shapes = [frame(page, part, 4), frame(page, part, 5)]
  await expect(shapes[1]!).toBeVisible()
  const ellipse = await placed(shapes[1]!)
  const square = await placed(shapes[0]!)
  await page.mouse.move(ellipse.x + ellipse.width / 2, ellipse.y + ellipse.height / 2)
  await page.mouse.down()
  await page.mouse.move(square.x + square.width / 2 + 260, square.y + square.height / 2 + 12, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  await shapes[0]!.click()
  await shapes[1]!.click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+A")
  await expect(status(page)).toHaveText(groupCopy.said.frame)
  return shapes
}

async function dragBy(page: Page, shape: Locator, dx: number, dy: number): Promise<void> {
  const box = await placed(shape)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Control")
}

function by(boxes: readonly Placed[], dx: number, dy: number): readonly Placed[] {
  return boxes.map((box) => ({ ...box, x: box.x + dx, y: box.y + dy }))
}

test("a child of a frame without auto layout moves on its own, follows its frame, and Shift+A lays it out again", async ({
  page,
  decks,
}) => {
  const part = "ppt/slides/slide1.xml"
  const shapes = await wrappedPair(page, part)
  const panel = page.locator("[data-design-panel]")
  await panel.getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
  const laid = await Promise.all(shapes.map(placed))
  await shapes[1]!.dblclick()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await dragBy(page, shapes[1]!, -40, 0)
  await holds(shapes, [laid[0]!, by([laid[1]!], -40, 0)[0]!])
  const apart = await Promise.all(shapes.map(placed))
  await shapes[0]!.click()
  await page.keyboard.press("Escape")
  await shapes[0]!.click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.6$/)
  await dragBy(page, shapes[0]!, 100, 0)
  await holds(shapes, by(apart, 100, 0))
  await page.reload()
  await decks.ready()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await holds(shapes, by(apart, 100, 0))
  await shapes[0]!.click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.6$/)
  await page.keyboard.press("Shift+A")
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  const [left, right] = await Promise.all(shapes.map(placed))
  expect(Math.abs(right!.y - left!.y)).toBeLessThanOrEqual(1.5)
  await page.getByRole("button", { name: undoCopy.undoNamed["add-auto-layout"], exact: true }).click()
  await holds(shapes, by(apart, 100, 0))
})

function centreOf(box: Placed): { readonly x: number; readonly y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragTo(page: Page, shape: Locator, x: number, y: number): Promise<void> {
  const box = await placed(shape)
  await page.mouse.move(centreOf(box).x, centreOf(box).y)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 10 })
  await page.mouse.up()
}

test("a shape dropped into an auto layout frame joins its row, a child dragged out leaves it, and Delete removes a child", async ({
  page,
}) => {
  const part = "ppt/slides/slide1.xml"
  const [square, circle] = await wrappedPair(page, part)
  const selection = page.locator("[data-slide-paint] [data-selection]")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.triangle, exact: true }).click()
  const triangle = frame(page, part, 8)
  await expect(triangle).toBeVisible()
  const left = await placed(square!)
  const right = await placed(circle!)
  await dragTo(page, triangle, (left.x + left.width + right.x) / 2, centreOf(left).y)
  await expect
    .poll(async () => {
      const [one, two, three] = await Promise.all([square!, triangle, circle!].map(placed))
      const before = two!.x - (one!.x + one!.width)
      const after = three!.x - (two!.x + two!.width)
      return before >= -1 && Math.abs(before - after) <= 1.5 && Math.abs(two!.y - one!.y) < 2
    })
    .toBe(true)
  await square!.dblclick()
  await expect(selection).toHaveAttribute("data-selection", /\.4$/)
  const row = await placed(triangle)
  await dragTo(page, square!, centreOf(row).x, centreOf(row).y + 260)
  await expect.poll(async () => (await placed(triangle)).x < row.x - 10).toBe(true)
  await expect.poll(async () => (await placed(square!)).y > row.y + row.height).toBe(true)
  const shifted = await placed(circle!)
  await circle!.click()
  await expect(selection).toHaveAttribute("data-selection", /\.5$/)
  await page.keyboard.press("Delete")
  await expect(circle!).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["delete-element"], exact: true }).click()
  await expect(circle!).toHaveCount(1)
  await holds([circle!], [shifted])
})
