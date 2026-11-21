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

function row(page: Page, shape: number): Locator {
  return page.locator(`[data-layers-panel] [data-layer-row$=".${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<Placed> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function at(locator: Locator, wanted: Placed): Promise<void> {
  await expect
    .poll(async () => {
      const now = await placed(locator)
      return Math.max(
        Math.abs(now.x - wanted.x),
        Math.abs(now.y - wanted.y),
        Math.abs(now.width - wanted.width),
        Math.abs(now.height - wanted.height),
      )
    })
    .toBeLessThanOrEqual(1.5)
}

const shifted = (box: Placed, x: number, y: number): Placed => ({ ...box, x: box.x + x, y: box.y + y })

async function opened(locator: Locator): Promise<void> {
  if ((await locator.getAttribute("aria-expanded")) === "false") await locator.locator("[data-layer-caret]").click()
  await expect(locator).toHaveAttribute("aria-expanded", "true")
}

test("a group Alt-drags into a copy with all its layers, a layer inside a turned group copies into that group, and the layers panel takes Ctrl+D", async ({
  page,
}) => {
  await openDeck(page, "nested-groups.pptx")
  const [leaf, twin, beside, loose] = [4, 5, 6, 7].map((shape) => painted(page, shape))
  const where = await Promise.all([leaf!, twin!, beside!].map(placed))

  const start = await placed(beside!)
  const press = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
  await page.mouse.move(press.x, press.y)
  await page.keyboard.down("AltLeft")
  await page.mouse.down()
  await page.mouse.move(press.x, press.y + 150, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("AltLeft")
  await expect(painted(page, 8)).toHaveCount(1)
  await expect(painted(page, 12)).toHaveCount(1)
  const offset = (await placed(painted(page, 12))).y - where[2]!.y
  expect(offset).toBeGreaterThan(140)
  for (const [index, copy] of [10, 11, 12].entries()) await at(painted(page, copy), shifted(where[index]!, 0, offset))
  for (const [index, layer] of [leaf, twin, beside].entries()) await at(layer!, where[index]!)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", "256.8")

  await page.getByRole("button", { name: undoCopy.undoNamed["duplicate-layer"], exact: true }).click()
  await expect(painted(page, 8)).toHaveCount(0)
  await expect(painted(page, 10)).toHaveCount(0)

  await leaf!.click({ modifiers: ["ControlOrMeta"] })
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(painted(page, 13)).toHaveCount(1)
  await at(painted(page, 13), where[0]!)
  await page.locator("[data-design-mode]").click()
  await opened(row(page, 2))
  await opened(row(page, 3))
  await expect(row(page, 13)).toHaveAttribute("aria-level", "3")
  await expect(row(page, 13)).toHaveAttribute("aria-selected", "true")

  const looseAt = await placed(loose!)
  await row(page, 7).click()
  await row(page, 7).focus()
  await expect(row(page, 7)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(painted(page, 14)).toHaveCount(1)
  await at(painted(page, 14), looseAt)
  await expect(row(page, 14)).toHaveAttribute("aria-selected", "true")
  await expect(row(page, 14)).toHaveAttribute("aria-level", "1")
})

test("a frame copies with Ctrl+D with its backdrop and layer, in place", async ({ page }) => {
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square ?? "", exact: true }).click()
  await page.keyboard.press("Enter")
  const square = painted(page, 4)
  await expect(square).toBeVisible()
  await square.click()
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  await page.locator("[data-design-mode]").click()
  const frames = page.locator('[data-layers-panel] [data-layer-kind="frame"]')
  await expect(frames).toHaveCount(1)
  const where = await placed(square)
  await square.click()
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(frames).toHaveCount(2)
  await at(painted(page, 9), where)
  await at(square, where)
  await page.getByRole("button", { name: undoCopy.undoNamed["duplicate-layer"], exact: true }).click()
  await expect(frames).toHaveCount(1)
})
