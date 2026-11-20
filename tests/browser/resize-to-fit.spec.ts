import { expect, test, type Locator, type Page } from "@playwright/test"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { frameCopy } from "../../apps/web/src/copy/frame-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

function shapeOf(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function dragFrom(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 6 })
  await page.mouse.up()
}

test("Ctrl+Alt+Shift+R and Resize to fit shrink or grow a plain frame around its children in one undo step", async ({
  page,
}) => {
  covers("resize-to-fit")
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await insert(page, shapeCopy.shapes.square)
  await insert(page, shapeCopy.shapes.circle)
  const rect = shapeOf(page, 4)
  const ellipse = shapeOf(page, 5)
  await expect(ellipse).toBeVisible()

  const rectBox = await boxOf(rect)
  const ellipseBox = await boxOf(ellipse)
  await dragFrom(page, ellipseBox.x + ellipseBox.width / 2, ellipseBox.y + ellipseBox.height / 2, 180, 70)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()

  await rect.click()
  await ellipse.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Control+Alt+KeyG")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said["plain-frame"])

  const selection = page.locator("[data-slide-paint] [data-selection]").first()
  await expect(selection).toBeVisible()
  const tight = await boxOf(selection)
  const childrenBefore = [await boxOf(rect), await boxOf(ellipse)]

  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByRole("button", { name: frameCopy.resizeToFit, exact: true })).toBeVisible()

  const corner = await boxOf(page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]'))
  await dragFrom(page, corner.x + corner.width / 2, corner.y + corner.height / 2, 140, 100)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()
  const enlarged = await boxOf(selection)
  expect(enlarged.width).toBeGreaterThan(tight.width + 80)
  expect(enlarged.height).toBeGreaterThan(tight.height + 60)

  await page.keyboard.press("Control+Alt+Shift+KeyR")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["resize-to-fit"], exact: true })).toBeEnabled()
  await expect.poll(async () => Math.abs((await boxOf(selection)).width - tight.width)).toBeLessThanOrEqual(2)
  const fitted = await boxOf(selection)
  expect(Math.abs(fitted.x - tight.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(fitted.y - tight.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(fitted.height - tight.height)).toBeLessThanOrEqual(2)
  const childrenAfterShrink = [await boxOf(rect), await boxOf(ellipse)]
  for (const [at, before] of childrenBefore.entries()) {
    expect(Math.abs(childrenAfterShrink[at]!.x - before.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(childrenAfterShrink[at]!.y - before.y)).toBeLessThanOrEqual(2)
  }

  await page.getByRole("button", { name: undoCopy.undoNamed["resize-to-fit"], exact: true }).click()
  await expect(page.getByRole("button", { name: undoCopy.redoNamed["resize-to-fit"], exact: true })).toBeEnabled()
  await rect.click()
  await expect(selection).toBeVisible()
  await expect.poll(async () => Math.abs((await boxOf(selection)).width - enlarged.width)).toBeLessThanOrEqual(2)

  await page.getByRole("button", { name: undoCopy.redoNamed["resize-to-fit"], exact: true }).click()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["resize-to-fit"], exact: true })).toBeEnabled()
  await rect.click()
  await expect(selection).toBeVisible()
  await expect.poll(async () => Math.abs((await boxOf(selection)).width - tight.width)).toBeLessThanOrEqual(2)

  await ellipse.dblclick({ position: { x: 10, y: 10 } })
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press(`${shortcutCopy.chord.other.shift}+ArrowUp`)
    await page.keyboard.press(`${shortcutCopy.chord.other.shift}+ArrowRight`)
  }
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  const movedEllipse = await boxOf(ellipse)
  const currentRect = await boxOf(rect)

  await page.keyboard.press(`${shortcutCopy.chord.other.shift}+Enter`)
  await expect(selection).toBeVisible()
  const beforeGrow = await boxOf(selection)
  expect(movedEllipse.y).toBeLessThan(beforeGrow.y - 10)

  await panel.getByRole("button", { name: frameCopy.resizeToFit, exact: true }).click()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["resize-to-fit"], exact: true })).toBeEnabled()
  const wantLeft = Math.min(currentRect.x, movedEllipse.x)
  const wantTop = Math.min(currentRect.y, movedEllipse.y)
  const wantRight = Math.max(currentRect.x + currentRect.width, movedEllipse.x + movedEllipse.width)
  const wantBottom = Math.max(currentRect.y + currentRect.height, movedEllipse.y + movedEllipse.height)
  await expect.poll(async () => Math.abs((await boxOf(selection)).y - wantTop)).toBeLessThanOrEqual(3)
  const grown = await boxOf(selection)
  expect(Math.abs(grown.x - wantLeft)).toBeLessThanOrEqual(3)
  expect(Math.abs(grown.x + grown.width - wantRight)).toBeLessThanOrEqual(3)
  expect(Math.abs(grown.y + grown.height - wantBottom)).toBeLessThanOrEqual(3)
  expect(Math.abs((await boxOf(rect)).x - currentRect.x)).toBeLessThanOrEqual(2)
  expect(Math.abs((await boxOf(rect)).y - currentRect.y)).toBeLessThanOrEqual(2)
  expect(Math.abs((await boxOf(ellipse)).x - movedEllipse.x)).toBeLessThanOrEqual(2)
  expect(Math.abs((await boxOf(ellipse)).y - movedEllipse.y)).toBeLessThanOrEqual(2)
})
