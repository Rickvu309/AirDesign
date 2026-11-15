import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { fixtures, openDeck, settled } from "./design-panel"
import { partsOf } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

const exportName = "exported-connection.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide10.xml"
const slideWidth = 12_192_000
const card = { x: 3_948_437, y: 4_728_663, cx: 914_400, cy: 914_400 }

function frame(page: Page, shape: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${shape}"]`)
}

function placement(element: Locator): Promise<readonly string[]> {
  return element.evaluate((node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height])
}

async function point(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  const scale = slide.width / slideWidth
  return { x: slide.x + x * scale, y: slide.y + y * scale }
}

async function pickConnector(page: Page) {
  const line = await frame(page, "26").boundingBox()
  if (line === null) throw new Error("no connector")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await expect(page.locator("[data-connector-end]")).toHaveCount(2)
}

test("a person drags a connector's end onto a site the hovered picture shows, moves that picture offline, and the connector follows before the network, through Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "census-updating-spm.pptx")
  await page.locator('[data-slide-entry="10"]').click()
  const line = frame(page, "26")
  const file = await placement(line)
  await pickConnector(page)
  await expect(page.locator("[data-grip='top-left']")).toHaveCount(0)

  const grip = await page.locator('[data-connector-end="end"]').boundingBox()
  if (grip === null) throw new Error("no end")
  const right = await point(page, card.x + card.cx, card.y + card.cy / 2)
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(right.x - 20, right.y + 6, { steps: 4 })
  await page.mouse.move(right.x - 2, right.y + 1, { steps: 2 })
  await expect(page.locator(`[data-connector-target$=".15"]`)).toHaveCount(4)
  await expect(page.locator("[data-connector-chosen]")).toHaveAttribute("data-connector-site", "3")
  await page.mouse.up()
  await expect(page.locator("[data-connector-site]")).toHaveCount(0)
  await expect.poll(() => placement(line)).not.toEqual(file)
  const bound = await placement(line)
  await expect(page.getByRole("button", { name: "Undo connector", exact: true })).toBeVisible()

  await page.context().setOffline(true)
  const picture = await frame(page, "15").boundingBox()
  if (picture === null) throw new Error("no picture")
  await page.mouse.move(picture.x + picture.width / 2, picture.y + picture.height / 2)
  await page.mouse.down()
  await page.mouse.move(picture.x + picture.width / 2 + 60, picture.y + picture.height / 2 - 40, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => placement(line)).not.toEqual(bound)
  const followed = await placement(line)
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => placement(line)).toEqual(bound)
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await expect.poll(() => placement(line)).toEqual(followed)
  await page.context().setOffline(false)

  await page.reload()
  await settled(page)
  await page.locator('[data-slide-entry="10"]').click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(followed)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const saved = testInfo.outputPath(exportName)
  await (await saving).saveAs(saved)
  const original = await partsOf(join(fixtures, "census-updating-spm.pptx"))
  const exported = await partsOf(saved)
  const slide = exported.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain('<a:stCxn id="6" idx="2"/><a:endCxn id="15" idx="3"/>')
  expect(slide).toContain('<a:prstGeom prst="line"><a:avLst/></a:prstGeom>')
  const changed = [...original].filter(([name, bytes]) => exported.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(saved, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(saved)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.locator('[data-slide-entry="10"]').click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(followed)
})
