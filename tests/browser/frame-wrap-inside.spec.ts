import { expect, test, type Locator, type Page } from "@playwright/test"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { decksOn } from "./deck-test"
import { openDeck } from "./design-panel"

const slidePart = "ppt/slides/slide1.xml"

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

test.use({ viewport: { width: 1600, height: 1000 } })

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

function near(left: Placed, right: Placed): boolean {
  return Math.abs(left.x - right.x) <= 1.5 && Math.abs(left.y - right.y) <= 1.5
}

async function insert(page: Page, name: string, shape: number): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  await expect(painted(page, shape)).toBeVisible()
}

async function drag(page: Page, shape: Locator, x: number, y: number): Promise<void> {
  const from = await placed(shape)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
}

test("Shift+A on two children of an auto layout frame wraps them in a frame at their place, and Undo puts them back", async ({
  page,
}) => {
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const status = page.locator("[data-slide-paint]").getByRole("status")
  const selection = page.locator("[data-slide-paint] [data-selection]")
  await insert(page, shapeCopy.shapes.square ?? "", 4)
  await insert(page, shapeCopy.shapes.circle ?? "", 5)
  await insert(page, shapeCopy.shapes.triangle ?? "", 6)
  const [square, circle, triangle] = [painted(page, 4), painted(page, 5), painted(page, 6)]
  const start = await placed(square)
  await drag(page, circle, start.x + start.width * 1.5 + 40, start.y + start.height / 2)
  await drag(page, triangle, start.x + start.width * 2.5 + 80, start.y + start.height / 2)
  await square.click()
  await circle.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await triangle.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Shift+A")
  await expect(status).toHaveText(groupCopy.said.frame)
  const row = await Promise.all([square, circle, triangle].map(placed))

  await circle.dblclick()
  await expect(selection).toHaveAttribute("data-selection", /\.5$/)
  await triangle.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Shift+A")
  await expect(status).toHaveText(groupCopy.said.frame)
  await expect(selection).toHaveAttribute("data-selection", /\.9$/)
  for (const [at, shape] of [square, circle, triangle].entries())
    await expect.poll(async () => near(await placed(shape), row[at]!)).toBe(true)
  const inner = await placed(painted(page, 9))
  expect(Math.abs(inner.x - row[1]!.x)).toBeLessThanOrEqual(1.5)
  expect(inner.x + inner.width).toBeGreaterThanOrEqual(row[2]!.x + row[2]!.width - 1.5)

  await page.getByRole("button", { name: undoCopy.undoNamed["add-auto-layout"], exact: true }).click()
  await expect(painted(page, 9)).toHaveCount(0)
  for (const [at, shape] of [square, circle, triangle].entries())
    await expect.poll(async () => near(await placed(shape), row[at]!)).toBe(true)
  await page.getByRole("button", { name: undoCopy.redoNamed["add-auto-layout"], exact: true }).click()
  await expect(painted(page, 9)).toHaveCount(1)
  await page.reload()
  await decksOn(page).ready()
  await expect(painted(page, 9)).toHaveCount(1)
  for (const [at, shape] of [square, circle, triangle].entries())
    await expect.poll(async () => near(await placed(shape), row[at]!)).toBe(true)
})
