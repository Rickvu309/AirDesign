import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
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

async function stays(locator: Locator, at: Placed): Promise<void> {
  await expect
    .poll(async () => {
      const now = await placed(locator)
      return Math.max(
        Math.abs(now.x - at.x),
        Math.abs(now.y - at.y),
        Math.abs(now.width - at.width),
        Math.abs(now.height - at.height),
      )
    })
    .toBeLessThanOrEqual(1.5)
}

async function dragOnto(page: Page, from: Locator, to: Locator, share: number, mark: string): Promise<void> {
  const start = await placed(from)
  const end = await placed(to)
  await page.mouse.move(start.x + 60, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + 60, end.y + end.height * share, { steps: 8 })
  await page.mouse.move(end.x + 61, end.y + end.height * share)
  await expect(page.locator(`[data-layers-panel] [data-layer-drop="${mark}"]`)).toBeVisible()
  await page.mouse.up()
}

function rows(page: Page) {
  const layers = page.locator("[data-layers-panel]")
  return (shape: number) => layers.locator(`[data-layer-row$=".${String(shape)}"]`)
}

async function opened(row: Locator): Promise<void> {
  if ((await row.getAttribute("aria-expanded")) === "false") await row.locator("[data-layer-caret]").click()
  await expect(row).toHaveAttribute("aria-expanded", "true")
}

test("a layer drops into a turned group two levels down, and dragging a group's last layers out deletes it until Undo", async ({
  page,
}) => {
  await openDeck(page, "nested-groups.pptx")
  await page.locator("[data-design-mode]").click()
  const row = rows(page)
  await opened(row(2))
  await opened(row(3))
  const [leaf, twin, beside, loose] = [4, 5, 6, 7].map((shape) => painted(page, shape))
  const where = await Promise.all([leaf!, twin!, beside!, loose!].map(placed))

  await dragOnto(page, row(7), row(3), 0.5, "inside")
  await expect(row(7)).toHaveAttribute("aria-level", "3")
  await stays(loose!, where[3]!)
  for (const [at, layer] of [leaf, twin, beside].entries()) await stays(layer!, where[at]!)
  await page.getByRole("button", { name: undoCopy.undoNamed["layer-order"], exact: true }).click()
  await expect(row(7)).toHaveAttribute("aria-level", "1")
  await stays(loose!, where[3]!)

  await dragOnto(page, row(4), row(7), 0.9, "below")
  await expect(row(4)).toHaveAttribute("aria-level", "1")
  await stays(leaf!, where[0]!)
  await dragOnto(page, row(5), row(4), 0.9, "below")
  await expect(row(5)).toHaveAttribute("aria-level", "1")
  await expect(row(3)).toHaveCount(0)
  await expect(row(5)).toHaveAttribute("aria-selected", "true")
  for (const [at, layer] of [leaf, twin, beside].entries()) await stays(layer!, where[at]!)

  await page.getByRole("button", { name: undoCopy.undoNamed["layer-order"], exact: true }).click()
  await expect(row(3)).toHaveCount(1)
  await opened(row(3))
  await expect(row(5)).toHaveAttribute("aria-level", "3")
  await stays(twin!, where[1]!)
  await page.getByRole("button", { name: undoCopy.redoNamed["layer-order"], exact: true }).click()
  await expect(row(3)).toHaveCount(0)
  await stays(twin!, where[1]!)
})

test("a frame drags into a group in the layers panel and keeps its place and its layer's", async ({ page }) => {
  await openDeck(page, "blank.pptx")
  for (const name of [shapeCopy.shapes.square, shapeCopy.shapes.circle, shapeCopy.shapes.triangle]) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name: name ?? "", exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  const [square, circle, triangle] = [painted(page, 4), painted(page, 5), painted(page, 6)]
  await expect(triangle).toBeVisible()
  await square.click()
  await page.keyboard.down("ShiftLeft")
  await circle.click()
  await page.keyboard.up("ShiftLeft")
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(painted(page, 7)).toHaveCount(1)
  await triangle.click()
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  const where = await Promise.all([square, circle, triangle].map(placed))

  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  const frame = layers.locator('[data-layer-kind="frame"]')
  await expect(frame).toHaveAttribute("aria-level", "1")
  await dragOnto(page, frame, rows(page)(7), 0.5, "inside")
  await expect(frame).toHaveAttribute("aria-level", "2")
  for (const [at, layer] of [square, circle, triangle].entries()) await stays(layer, where[at]!)
  await page.getByRole("button", { name: undoCopy.undoNamed["layer-order"], exact: true }).click()
  await expect(frame).toHaveAttribute("aria-level", "1")
  await stays(triangle, where[2]!)
})
