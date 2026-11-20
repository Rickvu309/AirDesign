import { productCopy, zoomCopy } from "../../apps/web/src/copy/product-copy"
import { expect, type Page } from "@playwright/test"
import { store } from "./home-store.ts"
import { covers } from "./gesture"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("New deck opens a menu that takes the focus, moves by arrow and gives the focus back on Escape", async ({
  page,
}) => {
  await store(page)
  await page.goto("/")
  const button = page.getByRole("button", { name: productCopy.newDeck, exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await page.keyboard.press("Enter")
  const menu = page.getByRole("menu", { name: productCopy.newDeck })
  await expect(menu).toBeVisible()
  const blank = menu.getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
  const importing = menu.getByRole("menuitem", { name: "Import PowerPoint", exact: true })
  await expect(blank).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(importing).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(blank).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  await expect(button).toBeFocused()
})

test("Tab goes from Grid view and List view to the next control, not into New deck's items", async ({ page }) => {
  await store(page)
  await page.goto("/")
  const button = page.getByRole("button", { name: productCopy.newDeck, exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "Grid view" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "List view" })).toBeFocused()
})

async function percent(page: Page): Promise<number> {
  const text = (await page.locator("[data-zoom-readout]").textContent()) ?? ""
  return Number(text.replace("%", ""))
}

test("Ctrl+= and Ctrl+- zoom the canvas, Ctrl+0 zooms to 100% and Shift+1 returns to Fit", async ({ page, decks }) => {
  covers("zoom-in", "zoom-out", "zoom-fit", "zoom-actual")
  await decks.open()
  const fit = await percent(page)
  await page.locator("[data-canvas-stage]").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("ControlOrMeta+=")
  await expect.poll(() => percent(page)).toBeGreaterThan(fit)
  const bigger = await percent(page)
  await page.keyboard.press("ControlOrMeta+=")
  await expect.poll(() => percent(page)).toBeGreaterThan(bigger)
  await page.keyboard.press("ControlOrMeta+-")
  await expect.poll(() => percent(page)).toBe(bigger)
  await page.keyboard.press("ControlOrMeta+0")
  await expect.poll(() => percent(page)).toBe(100)
  await page.keyboard.press("Shift+Digit1")
  await expect.poll(() => percent(page)).toBe(fit)
  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
})

test("the zoom menu opens on its percent field, then Zoom in, Zoom out, fit and the three presets", async ({
  page,
  decks,
}) => {
  await decks.open()
  const fit = await percent(page)
  await page.locator("[data-zoom-readout]").click()
  const field = page.getByRole("textbox", { name: zoomCopy.field })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue(`${String(fit)}%`)
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    `${zoomCopy.zoomIn}${zoomCopy.inKey}`,
    `${zoomCopy.zoomOut}${zoomCopy.outKey}`,
  ])
  await expect(page.getByRole("menuitemradio")).toHaveText([
    `${zoomCopy.fit}${zoomCopy.fitKey}`,
    "Zoom to 50%",
    `Zoom to 100%${zoomCopy.hundredKey}`,
    "Zoom to 200%",
  ])
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
  const edge = await page.getByRole("menu").evaluate((menu) => {
    const input = menu.querySelector("input")
    const label = menu.querySelector("[role=menuitem] span:nth-child(2)")
    if (input === null || label === null) return null
    const style = getComputedStyle(input)
    return {
      outline: style.outlineStyle,
      border: style.borderTopColor === style.borderLeftColor ? style.borderTopWidth : "uneven",
      text: Math.round(
        input.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
      ),
      label: Math.round(label.getBoundingClientRect().left),
    }
  })
  expect(edge?.outline).toBe("none")
  expect(edge?.border).toBe("2px")
  expect(edge?.text).toBe(edge?.label)
})

test("a percent typed into the zoom field sets the zoom, and text that is not a percent is put back", async ({
  page,
  decks,
}) => {
  await decks.open()
  const fit = await percent(page)
  await page.locator("[data-zoom-readout]").click()
  const field = page.getByRole("textbox", { name: zoomCopy.field })
  await expect(field).toBeFocused()
  await page.keyboard.type("big")
  await page.keyboard.press("Enter")
  await expect(field).toHaveValue(`${String(fit)}%`)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("137")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(page.locator("[data-zoom-readout]")).toHaveText("137%")
  await expect(page.locator("[data-zoom-readout]")).toBeFocused()
})

test("Ctrl+= inside a text box is left to the browser", async ({ page, decks }) => {
  await decks.open()
  const fit = await percent(page)
  await page.locator("[data-slide-entry='1']").click()
  const title = page.locator('[contenteditable="true"]').first()
  await title.focus()
  await page.keyboard.press("ControlOrMeta+=")
  expect(await percent(page)).toBe(fit)
})

test("Expand presenter notes is one tab stop", async ({ page, decks }) => {
  await decks.open()
  await page.getByRole("button", { name: "Collapse presenter notes" }).click()
  const expand = page.getByRole("button", { name: "Expand presenter notes" })
  await expect(expand).toHaveCount(1)
  await expand.focus()
  await page.keyboard.press("Tab")
  await expect(expand).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).not.toBe(
    "Expand presenter notes",
  )
})
