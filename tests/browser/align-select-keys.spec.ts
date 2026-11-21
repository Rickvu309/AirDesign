import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function addShapes(page: Page): Promise<Locator> {
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const initial = await layers.count()
  for (const [index, name] of [shapeCopy.shapes.square, shapeCopy.shapes.circle].entries()) {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(layers).toHaveCount(initial + index + 1)
    await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  }
  return layers
}

async function selectedCount(page: Page): Promise<number> {
  const design = page.locator("[data-design-element]")
  if ((await design.count()) === 0) return 0
  return (await design.getAttribute("data-design-element"))?.split(" ").length ?? 0
}

async function edges(layer: Locator) {
  const box = await layer.boundingBox()
  if (box === null) throw new Error("layer box")
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

test("Ctrl+A selects every layer on the slide, Ctrl+Shift+A the others, from a layer or the slide", async ({
  page,
}) => {
  covers("select-all", "select-inverse")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = await addShapes(page)
  const total = await layers.count()
  await layers.first().click()
  await expect.poll(() => selectedCount(page)).toBe(1)
  await page.keyboard.press("ControlOrMeta+Shift+A")
  await expect.poll(() => selectedCount(page)).toBe(total - 1)
  await page.keyboard.press("ControlOrMeta+A")
  await expect.poll(() => selectedCount(page)).toBe(total)
  await page.keyboard.press("ControlOrMeta+Shift+A")
  await expect.poll(() => selectedCount(page)).toBe(0)
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+A")
  await expect.poll(() => selectedCount(page)).toBe(total)
})

test("Alt with A, H, D, W, V and S aligns the selected layers as the Align buttons do", async ({ page }) => {
  covers("align-left", "align-center", "align-right", "align-top", "align-middle", "align-bottom")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = await addShapes(page)
  const [one, two] = [layers.first(), layers.nth(-2)]
  await layers.last().click()
  await page.keyboard.press("ControlOrMeta+Shift+A")
  await expect.poll(() => selectedCount(page)).toBe(2)
  const gap = async (side: keyof Awaited<ReturnType<typeof edges>>) =>
    Math.abs((await edges(one))[side] - (await edges(two))[side])
  for (const [key, side] of [
    ["Alt+KeyA", "left"],
    ["Alt+KeyH", "x"],
    ["Alt+KeyD", "right"],
    ["Alt+KeyW", "top"],
    ["Alt+KeyV", "y"],
    ["Alt+KeyS", "bottom"],
  ] as const) {
    expect(await gap(side)).toBeGreaterThan(4)
    await page.keyboard.press(key)
    await expect.poll(() => gap(side)).toBeLessThan(1.5)
  }
})

test("Alt+Shift+A removes the auto layout Shift+A added", async ({ page }) => {
  covers("remove-auto-layout")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = await addShapes(page)
  await layers.first().click()
  await page.keyboard.press("ControlOrMeta+Shift+A")
  await expect.poll(() => selectedCount(page)).toBe(2)
  await page.keyboard.press("Shift+A")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["add-auto-layout"], exact: true })).toBeVisible()
  await expect.poll(() => selectedCount(page)).toBe(1)
  await page.keyboard.press("Alt+Shift+A")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["remove-auto-layout"], exact: true })).toBeVisible()
})
