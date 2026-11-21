import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { selectionColorsCopy } from "../../apps/web/src/copy/selection-colors-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("Shift+D toggles Design mode and types a capital D while editing", async ({ page }) => {
  covers("design-mode")
  await openDeck(page, "clean.pptx")
  const mode = page.getByRole("button", { name: designCopy.designMode, exact: true })
  await mode.focus()
  await page.keyboard.press("Shift+D")
  await expect(mode).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Shift+D")
  await expect(mode).toHaveAttribute("aria-pressed", "false")
  const layer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const editor = layer.locator('[contenteditable="true"]')
  await editor.click()
  await editor.press("End")
  await page.keyboard.press("Shift+D")
  await expect(editor).toHaveText("HelloD")
  await expect(mode).toHaveAttribute("aria-pressed", "false")
})

test("the target in Selection colors selects matching layers on the slide", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const initial = await layers.count()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  for (const [index, name] of [shapeCopy.shapes.square, shapeCopy.shapes.circle].entries()) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(layers).toHaveCount(initial + index + 1)
    await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  }
  await layers.last().click()
  const section = page.locator("[data-selection-colors]")
  const target = section.getByRole("button", { name: new RegExp(`^${selectionColorsCopy.select("")}`) }).first()
  await expect(target).toBeVisible()
  const row = await section.boundingBox()
  const control = await target.boundingBox()
  if (row === null || control === null) throw new Error("Selection colors row")
  expect(control.x + control.width).toBeLessThanOrEqual(row.x + row.width)
  await target.click()
  const selected = page.locator("[data-design-element]")
  expect((await selected.getAttribute("data-design-element"))?.split(" ")).toHaveLength(2)
})
