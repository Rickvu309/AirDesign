import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { savedExport } from "./export-dialog"
import { covers } from "./gesture"
import { test } from "./deck-test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1470, height: 923 } })

function layer(page: Page, shape: number) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function placed(page: Page, shape: number): Promise<number[]> {
  return layer(page, shape).evaluate((frame: HTMLElement) =>
    [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
  )
}

async function painted(page: Page): Promise<(string | undefined)[]> {
  return page
    .locator(`[data-slide-paint] [data-canvas-element^="${slidePart}#"]`)
    .evaluateAll((all) => all.map((each) => /#(\d+)$/.exec(each.getAttribute("data-canvas-element") ?? "")?.[1]))
}

function chosen(page: Page) {
  return page.locator("[data-slide-paint] [data-selection]")
}

test("Alt-drag leaves a layer in place and moves a copy above it, Ctrl+D repeats the distance, and one undo takes one copy away @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("duplicate-drag", "duplicate")
  await page.goto(".")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await decks.ready()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  expect(await placed(page, 2)).toEqual([30, 30, 360, 120])
  const press = { x: Math.round(slide.x) + 100, y: Math.round(slide.y) + 80 }
  await page.mouse.move(press.x, press.y)
  await page.keyboard.down("AltLeft")
  await page.mouse.down()
  await page.mouse.move(press.x + 40, press.y + 150, { steps: 6 })
  await expect(page.locator("[data-copied-layer]")).toHaveCount(1)
  expect(await placed(page, 2)).toEqual([70, 180, 360, 120])
  await page.mouse.up()
  await page.keyboard.up("AltLeft")
  await expect(layer(page, 3)).toBeVisible()
  await expect(page.locator("[data-copied-layer]")).toHaveCount(0)
  expect(await placed(page, 2)).toEqual([30, 30, 360, 120])
  expect(await placed(page, 3)).toEqual([70, 180, 360, 120])
  await expect(chosen(page)).toHaveAttribute("data-selection", "256.3")

  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(layer(page, 4)).toBeVisible()
  expect(await placed(page, 4)).toEqual([110, 330, 360, 120])
  await expect(chosen(page)).toHaveAttribute("data-selection", "256.4")
  expect(await painted(page)).toEqual(["2", "3", "4"])

  await page.getByRole("button", { name: undoCopy.undoNamed["duplicate-layer"], exact: true }).click()
  await expect(layer(page, 4)).toHaveCount(0)
  await expect(layer(page, 3)).toBeVisible()
  await page.getByRole("button", { name: undoCopy.redoNamed["duplicate-layer"], exact: true }).click()
  await expect(layer(page, 4)).toBeVisible()

  const exported = testInfo.outputPath("exported-layer-duplicate.pptx")
  await savedExport(page, exported)
  await copyFile(exported, join(process.cwd(), "tests/browser/exported-layer-duplicate.pptx"))
})
