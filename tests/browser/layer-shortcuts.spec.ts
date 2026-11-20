import { expect, test, type Locator, type Page } from "@playwright/test"
import { arrangeCopy, groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { frameCopy } from "../../apps/web/src/copy/frame-copy"
import { layersCopy } from "../../apps/web/src/copy/layers-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

async function insert(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
}

function shapeOf(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${String(shape)}"]`)
}

function status(page: Page): Locator {
  return page.locator("[data-slide-paint]").getByRole("status")
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function paintedOrder(page: Page, ids: readonly string[]): Promise<string[]> {
  const seen = await page
    .locator("[data-slide-paint] [data-canvas-element]")
    .evaluateAll((nodes) =>
      nodes.map((node) => /(\d+)$/.exec(node.getAttribute("data-canvas-element") ?? "")?.[1] ?? ""),
    )
  return seen.filter((each) => ids.includes(each))
}

test("Ctrl+Alt+G and Cmd+Option+G wrap the selection in a plain frame without reflowing", async ({ page }) => {
  covers("frame")
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await insert(page, shapeCopy.shapes.square)
  await insert(page, shapeCopy.shapes.circle)
  const rect = shapeOf(page, 4)
  const ellipse = shapeOf(page, 5)
  await expect(ellipse).toBeVisible()
  const rectBox = await boxOf(rect)
  const ellipseBox = await boxOf(ellipse)
  await page.mouse.move(ellipseBox.x + ellipseBox.width / 2, ellipseBox.y + ellipseBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rectBox.x + rectBox.width / 2 + 220, rectBox.y + rectBox.height / 2 + 56, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  const before = [await boxOf(rect), await boxOf(ellipse)]
  expect(Math.abs(before[1]!.y - before[0]!.y)).toBeGreaterThan(20)

  await rect.click()
  await ellipse.click({ modifiers: ["Shift"] })
  await page.keyboard.press("Control+Alt+KeyG")
  await expect(status(page)).toHaveText(groupCopy.said["plain-frame"])
  await expect(shapeOf(page, 7)).toHaveCount(1)
  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toHaveCount(0)
  const after = [await boxOf(rect), await boxOf(ellipse)]
  for (const [at, box] of before.entries()) {
    expect(Math.abs(after[at]!.x - box.x)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(after[at]!.y - box.y)).toBeLessThanOrEqual(1.5)
  }

  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.locator('[data-layer-kind="frame"]')).toHaveCount(1)

  await page.getByRole("button", { name: undoCopy.undoNamed.frame, exact: true }).click()
  await expect(shapeOf(page, 6)).toHaveCount(0)
  const undone = [await boxOf(rect), await boxOf(ellipse)]
  for (const [at, box] of before.entries()) {
    expect(Math.abs(undone[at]!.x - box.x)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(undone[at]!.y - box.y)).toBeLessThanOrEqual(1.5)
  }

  await page.getByRole("button", { name: undoCopy.redoNamed.frame, exact: true }).click()
  await expect(shapeOf(page, 6)).toHaveCount(1)
  const redone = [await boxOf(rect), await boxOf(ellipse)]
  for (const [at, box] of before.entries()) {
    expect(Math.abs(redone[at]!.x - box.x)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(redone[at]!.y - box.y)).toBeLessThanOrEqual(1.5)
  }

  await insert(page, shapeCopy.shapes.triangle)
  const triangle = shapeOf(page, 8)
  await expect(triangle).toBeVisible()
  await triangle.click()
  await page.keyboard.press("Meta+Alt+KeyG")
  await expect(status(page)).toHaveText(groupCopy.said["plain-frame"])
  await expect(layers.locator('[data-layer-kind="frame"]')).toHaveCount(2)
})

test("Cmd or Ctrl+R renames the selected layer in the layers panel without reloading the page", async ({ page }) => {
  covers("rename")
  await openDeck(page, "blank.pptx")
  await insert(page, shapeCopy.shapes.square)
  const rect = shapeOf(page, 4)
  await expect(rect).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__samePage = true
  })

  await rect.click()
  await page.keyboard.press("Control+KeyR")
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__samePage)).toBe(true)
  const layers = page.locator("[data-layers-panel]")
  const field = layers.locator("[data-layer-name-field]")
  await expect(field).toBeFocused()
  await field.fill("Hero card")
  await field.press("Enter")
  await expect(layers.getByRole("treeitem", { name: "Hero card", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.rename, exact: true })).toBeEnabled()

  await layers.locator("[data-layers-fold]").click()
  await expect(layers.locator("[data-layer-list]")).toHaveCount(0)
  await page.keyboard.press("Meta+KeyR")
  await expect(field).toBeFocused()
  await expect(field).toHaveValue("Hero card")
  await field.press("Escape")
  await expect(layers.getByRole("treeitem", { name: "Hero card", exact: true })).toBeVisible()

  await page.locator("[data-slide-paint]").click({ position: { x: 8, y: 8 } })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(0)
  await page.evaluate(() => {
    const spy = (event: KeyboardEvent) => {
      if (event.code !== "KeyR" || (!event.ctrlKey && !event.metaKey)) return
      ;(window as unknown as Record<string, unknown>).__reloadPrevented = event.defaultPrevented
      event.preventDefault()
      window.removeEventListener("keydown", spy)
    }
    window.addEventListener("keydown", spy)
  })
  await page.keyboard.press("Control+KeyR")
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__reloadPrevented)).toBe(false)
})

test("Figma stack keys reorder layers on the slide and in the layers panel without catching text input", async ({
  page,
}) => {
  await openDeck(page, "blank.pptx")
  await insert(page, shapeCopy.shapes.square)
  await insert(page, shapeCopy.shapes.circle)
  await insert(page, shapeCopy.shapes.triangle)
  const ids = ["2", "3", "4", "5", "6"]
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "4", "5", "6"])

  const rect = shapeOf(page, 4)
  await rect.click()
  await page.keyboard.press("BracketRight")
  await expect(status(page)).toHaveText(arrangeCopy.said.front)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "6", "4"])

  await page.keyboard.press("Control+BracketLeft")
  await expect(status(page)).toHaveText(arrangeCopy.said.backward)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "4", "6"])

  await page.keyboard.press("Control+BracketRight")
  await expect(status(page)).toHaveText(arrangeCopy.said.forward)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "6", "4"])

  await page.keyboard.press("BracketLeft")
  await expect(status(page)).toHaveText(arrangeCopy.said.back)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["4", "2", "3", "5", "6"])

  await page.keyboard.press("Meta+Alt+BracketRight")
  await expect(status(page)).toHaveText(arrangeCopy.said.front)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "6", "4"])

  await page.keyboard.press("Meta+Alt+BracketLeft")
  await expect(status(page)).toHaveText(arrangeCopy.said.back)
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["4", "2", "3", "5", "6"])

  const box = await boxOf(rect)
  await page.mouse.click(box.x + 8, box.y + 8, { button: "right" })
  await expect(
    page.getByRole("menuitem", { name: `${groupCopy.label["plain-frame"]} ${groupCopy.shortcut["plain-frame"]}` }),
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: `${arrangeCopy.label.front} ${arrangeCopy.shortcut.front}` }),
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: `${arrangeCopy.label.back} ${arrangeCopy.shortcut.back}` }),
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByRole("heading", { name: layersCopy.section })).toBeVisible()
  const row = layers.locator('[data-layer-row$=".4"]')
  await row.focus()
  await page.keyboard.press("BracketRight")
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "6", "4"])

  const title = shapeOf(page, 2)
  await title.dblclick()
  const editable = title.locator('[contenteditable="true"]')
  await expect(editable).toBeFocused()
  await page.keyboard.type("[note]")
  await expect(editable).toContainText("[note]")
  await expect.poll(() => paintedOrder(page, ids)).toEqual(["2", "3", "5", "6", "4"])
})
