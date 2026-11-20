import { expect, test, type Page } from "@playwright/test"
import { fillWords } from "../../apps/web/src/copy/fill-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { colorWords } from "./color-words"
import { openDeck, pickColor } from "./design-panel"
import { covers } from "./gesture"
import { fillPanel, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

function highlighted(page: Page): Promise<string> {
  return page.evaluate(() => window.getSelection()?.toString() ?? "")
}

test("Tab while typing in plain text keeps the caret in that text layer, as in Figma", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const slide = page.locator("[data-slide-paint]")
  const layers = slide.locator("[data-canvas-element]")
  const title = shapeAt(page, "2")
  const titleText = await title.innerText()
  const initial = await layers.count()
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  const typing = slide.locator('[contenteditable="true"]:focus')
  await expect(typing).toHaveCount(1)
  const key = await typing.evaluate((node) =>
    node.closest("[data-canvas-element]")?.getAttribute("data-canvas-element"),
  )
  const box = slide.locator(`[data-canvas-element="${key ?? ""}"] [contenteditable="true"]`)
  await page.keyboard.type("abc")
  await page.keyboard.press("Tab")
  await page.keyboard.type("o")
  await page.keyboard.press("Shift+Tab")
  await page.keyboard.type("1")
  await expect(box).toBeFocused()
  await expect(box).toHaveText("abco1")
  await expect(layers).toHaveCount(initial + 1)
  await expect(title).toHaveText(titleText)
})

test("leaving text editing leaves no words highlighted, as in Figma", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const slide = page.locator("[data-slide-paint]")
  const title = shapeAt(page, "2")
  const text = title.locator('[contenteditable="true"]')
  await title.click()
  await page.keyboard.press("Enter")
  await expect(text).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await expect.poll(() => highlighted(page)).not.toBe("")
  await page.keyboard.press("Escape")
  await expect(title).toBeFocused()
  await expect.poll(() => highlighted(page)).toBe("")
  await slide.click({ position: { x: 4, y: 4 } })
  await expect.poll(() => highlighted(page)).toBe("")
  await expect(text).not.toBeFocused()
})

test("Enter or Escape in a design panel control, or a pick from a picker, gives the keys back to the canvas, as in Figma", async ({
  page,
}) => {
  covers("leave-control")
  await openDeck(page, "shapes-added.pptx")
  const names = await colorWords("shapes-added.pptx")
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const initial = await layers.count()
  const rectangle = shapeAt(page, "4")
  const panel = await fillPanel(page, rectangle)
  const opacity = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })

  await opacity.fill("50")
  await opacity.press("Enter")
  await expect(opacity).toHaveValue(/^50/)
  await expect(rectangle).toBeFocused()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(layers).toHaveCount(initial + 1)

  await opacity.fill("20")
  await opacity.press("Escape")
  await expect(opacity).toHaveValue(/^50/)
  await expect(panel).not.toContainText("20%")
  await page.keyboard.press("r")
  await expect(layers).toHaveCount(initial + 2)

  const oval = shapeAt(page, "5")
  await oval.click()
  await expect(oval).toBeFocused()
  await pickColor(page, panel.getByLabel(fillWords.color, { exact: true }), names.accent2)
  await expect(oval).toBeFocused()
  await page.keyboard.press("l")
  await expect(layers).toHaveCount(initial + 3)
})
