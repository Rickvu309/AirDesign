import { expect, test, type Locator, type Page } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { fillWords } from "../../apps/web/src/copy/fill-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck, typeColor } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const redHex = "D93829"
const blueHex = "1D4FD8"
const greenHex = "16A34A"

async function addShape(page: Page, name: string): Promise<Locator> {
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const before = await layers.count()
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(layers).toHaveCount(before + 1)
  const key = await layers.last().getAttribute("data-canvas-element")
  if (key === null) throw new Error("missing key")
  return page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`)
}

function colorButton(page: Page, label: string = fillWords.color): Locator {
  return page
    .locator("[data-design-element]")
    .getByRole("button", { name: new RegExp(`^${label} `) })
    .first()
}

async function moveLayerTo(page: Page, layer: Locator, dx: number, dy: number): Promise<void> {
  const box = await layer.boundingBox()
  if (box === null) throw new Error("missing layer")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 4 })
  await page.mouse.up()
}

test("pressing I samples a color from the slide for shapes, text and mixed selections, and Esc cancels", async ({
  page,
}) => {
  covers("tool-eyedropper")
  await page.addInitScript(() => {
    delete (window as { EyeDropper?: unknown }).EyeDropper
  })
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()

  const textLayer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const swatch = await addShape(page, shapeCopy.shapes.square)
  await moveLayerTo(page, swatch, -180, 90)
  await swatch.click()
  await typeColor(page, colorButton(page), redHex)
  await expect(colorButton(page)).toContainText(redHex)

  const target = await addShape(page, shapeCopy.shapes.circle)
  await moveLayerTo(page, target, 180, 90)
  await target.click()
  const beforeTarget = await colorButton(page).innerText()

  const swatchBox = await swatch.boundingBox()
  if (swatchBox === null) throw new Error("missing swatch")
  const sampleX = swatchBox.x + swatchBox.width / 2
  const sampleY = swatchBox.y + swatchBox.height / 2

  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.move(sampleX, sampleY)
  await expect(page.locator("[data-eyedropper-preview]")).toHaveText(colorCopy.hexName(redHex))
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-eyedropper-overlay]")).toHaveCount(0)
  await expect(colorButton(page)).toHaveText(beforeTarget)
  await expect(page.locator("[data-selection]")).toBeVisible()

  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.move(sampleX, sampleY)
  await page.mouse.click(sampleX, sampleY)
  await expect(page.locator("[data-eyedropper-overlay]")).toHaveCount(0)
  await expect(colorButton(page)).toContainText(redHex)

  await textLayer.click()
  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.click(sampleX, sampleY)
  await expect(colorButton(page, formatCopy.color)).toContainText(redHex)

  await swatch.click()
  await typeColor(page, colorButton(page), blueHex)
  await expect(colorButton(page)).toContainText(blueHex)

  await target.click()
  await textLayer.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("i")
  await expect(page.locator("[data-eyedropper-overlay]")).toBeVisible()
  await page.mouse.click(sampleX, sampleY)

  await target.click()
  await expect(colorButton(page)).toContainText(blueHex)
  await textLayer.click()
  await expect(colorButton(page, formatCopy.color)).toContainText(blueHex)

  await page.keyboard.press("ControlOrMeta+z")
  await target.click()
  await expect(colorButton(page)).toContainText(redHex)
  await textLayer.click()
  await expect(colorButton(page, formatCopy.color)).toContainText(redHex)
})

test("pressing I uses window.EyeDropper when the browser provides it and aborts on Esc", async ({ page }) => {
  await page.addInitScript(
    ({ color }) => {
      const state = {
        opens: 0,
        aborted: 0,
        mode: "resolve" as "resolve" | "hold",
        color,
      }
      ;(window as unknown as { __dropper?: typeof state }).__dropper = state
      ;(window as unknown as { EyeDropper?: unknown }).EyeDropper = class {
        open(options?: { readonly signal?: AbortSignal }) {
          state.opens += 1
          if (state.mode === "resolve") return Promise.resolve({ sRGBHex: state.color })
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              state.aborted += 1
              reject(new DOMException("aborted", "AbortError"))
            })
          })
        }
      }
    },
    { color: colorCopy.hexName(greenHex) },
  )
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()

  const textLayer = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const shape = await addShape(page, shapeCopy.shapes.square)
  await shape.click()
  await page.keyboard.press("i")
  await expect(colorButton(page)).toContainText(greenHex)
  expect(await page.evaluate(() => (window as unknown as { __dropper: { opens: number } }).__dropper.opens)).toBe(1)

  await textLayer.click()
  await page.keyboard.press("i")
  await expect(colorButton(page, formatCopy.color)).toContainText(greenHex)

  await page.evaluate(() => {
    ;(window as unknown as { __dropper: { mode: string } }).__dropper.mode = "hold"
  })
  await shape.click()
  await page.keyboard.press("i")
  await page.keyboard.press("Escape")
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __dropper: { aborted: number } }).__dropper.aborted))
    .toBe(1)
})
