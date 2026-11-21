import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
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

function field(page: Page, name: string): Locator {
  return page.locator("[data-design-element]").getByRole("textbox", { name, exact: true })
}

test("Ctrl+Alt+C copies a layer's properties and Ctrl+Alt+V pastes them on another", async ({ page }) => {
  covers("copy-properties", "paste-properties")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = await addShapes(page)
  await layers.nth(-2).click()
  await page.keyboard.press("4")
  await expect(field(page, opacityCopy.label)).toHaveValue(/^40/)
  await page.keyboard.press("ControlOrMeta+Alt+KeyC")
  await layers.last().click()
  await expect(field(page, opacityCopy.label)).toHaveValue(/^100/)
  await page.keyboard.press("ControlOrMeta+Alt+KeyV")
  await expect(field(page, opacityCopy.label)).toHaveValue(/^40/)
})

test("Ctrl+Alt with the up and down arrows turns the selection by 1 degree, and by 15 with Shift", async ({ page }) => {
  covers("rotate-keys")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = await addShapes(page)
  const circle = layers.last()
  await circle.click()
  const turn = () =>
    circle.evaluate((node) => Number(/rotate\(([-\d.]+)deg\)/.exec((node as HTMLElement).style.transform)?.[1] ?? 0))
  await page.keyboard.press("ControlOrMeta+Alt+ArrowDown")
  await expect.poll(turn).toBe(1)
  await page.keyboard.press("ControlOrMeta+Alt+Shift+ArrowDown")
  await expect.poll(turn).toBe(16)
  await page.keyboard.press("ControlOrMeta+Alt+ArrowUp")
  await expect.poll(turn).toBe(15)
})

test("Ctrl+backslash hides everything but the slide, and Ctrl+Shift+backslash hides the slide list", async ({
  page,
}) => {
  covers("hide-ui", "slide-list")
  await openDeck(page, "clean.pptx")
  const toolbar = page.locator("[data-editor-toolbar]")
  const list = page.locator("[data-slide-list]")
  const panel = page.locator("[data-panel-resize]").or(page.getByRole("button", { name: transitionCopy.design }))
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("ControlOrMeta+Backslash")
  await expect(toolbar).toHaveCount(0)
  await expect(list).toHaveCount(0)
  await expect(panel).toHaveCount(0)
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Backslash")
  await expect(toolbar).toBeVisible()
  await expect(list).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Shift+Backslash")
  await expect(list).toHaveCount(0)
  await expect(toolbar).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Shift+Backslash")
  await expect(list).toBeVisible()
})

test("Alt+/ removes a layer's fill, Shift+/ its border, and Ctrl+Shift+7 numbers its paragraphs", async ({ page }) => {
  covers("remove-fill", "remove-border", "numbers")
  await openDeck(page, "clean.pptx")
  const layers = await addShapes(page)
  const square = layers.nth(-2)
  await square.click()
  const stroked = square.locator('svg [stroke]:not([stroke="none"])')
  const filled = () =>
    square.evaluate(
      (node) =>
        [node, ...node.querySelectorAll("*")].filter((each) => {
          const look = getComputedStyle(each)
          const fill = each.getAttribute("fill")
          return look.backgroundColor !== "rgba(0, 0, 0, 0)" || (fill !== null && fill !== "none")
        }).length,
    )
  await expect(stroked).not.toHaveCount(0)
  expect(await filled()).toBeGreaterThan(0)
  await page.keyboard.press("Shift+Slash")
  await expect(stroked).toHaveCount(0)
  await page.keyboard.press("Alt+Slash")
  await expect.poll(filled).toBe(0)

  const hello = layers.first()
  await hello.click()
  const bullet = () =>
    hello
      .locator("[data-paragraph]")
      .first()
      .evaluate((node) => getComputedStyle(node).getPropertyValue("--bullet").trim())
  expect(await bullet()).toBe("none")
  await page.keyboard.press("ControlOrMeta+Shift+Digit7")
  await expect.poll(bullet).not.toBe("none")
})

test("Ctrl+Alt+> and Ctrl+Alt+< step a text layer to the family's next weight", async ({ page }) => {
  covers("weight-up", "weight-down")
  await openDeck(page, "clean.pptx")
  const hello = page.locator("[data-slide-paint] [data-canvas-element]").first()
  await hello.click()
  const weight = () =>
    hello
      .locator("[data-run]")
      .first()
      .evaluate((node) => getComputedStyle(node).fontWeight)
  expect(await weight()).toBe("400")
  await page.keyboard.press("ControlOrMeta+Alt+Shift+Period")
  await expect.poll(weight).toBe("700")
  await page.keyboard.press("ControlOrMeta+Alt+Shift+Period")
  await page.keyboard.press("ControlOrMeta+Alt+Shift+Comma")
  await expect.poll(weight).toBe("400")
})
