import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { deckActionsOf } from "../../apps/web/src/copy/product-copy"
import { clean, entry, openFile, openGrid, sectioned } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

async function gridState(page: Page) {
  return page.locator("[data-editor-grid]").evaluate((grid) => ({
    slides: [...grid.querySelectorAll("[data-slide-entry]")].map((slide) => ({
      text: slide.textContent,
      selected: slide.hasAttribute("data-selected"),
      current: slide.getAttribute("aria-current"),
    })),
    editing: grid.querySelectorAll("[data-grid-edit]").length,
    elements: grid.querySelectorAll("[data-selection]").length,
    position: grid.querySelector("[data-slide-list]")?.getAttribute("style"),
    zoom: grid.querySelector("[data-zoom-readout]")?.textContent,
  }))
}

test("a focused slide menu owns the zoom shortcuts", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText("Hello")
  await expect(entry(page, 2).locator("[data-thumb-paint]")).toContainText("Heat pumps")
  await entry(page, 1).focus()
  await page.keyboard.press("ContextMenu")
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  const before = await gridState(page)
  for (const key of [
    slideListCopy.deleteKey,
    "ArrowRight",
    slideListCopy.openKey,
    "Space",
    "Alt+ArrowRight",
    "ControlOrMeta+d",
  ]) {
    await entry(page, 1).focus()
    await page.keyboard.press(key)
    expect(await gridState(page), key).toEqual(before)
    await expect(menu).toBeVisible()
  }
  await menu.focus()
  await page.keyboard.press("ControlOrMeta+Equal")
  expect(await gridState(page)).toEqual(before)
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(entry(page, 1)).toBeFocused()
})

for (const overlay of ["zoom", "title", "shapes"]) {
  test(`${overlay} owns Escape and grid shortcuts before overlay focus settles`, async ({ page }) => {
    await openFile(page, clean)
    await openGrid(page)
    await entry(page, 1).focus()
    await page.keyboard.press("Enter")
    await page.locator("[data-grid-edit] [data-canvas-element]").first().click({ force: true })
    if (overlay === "zoom") await page.locator("[data-zoom-readout]").click()
    else if (overlay === "title") await page.getByRole("button", { name: deckActionsOf("clean") }).click()
    else await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    const popup = page.locator('[role="menu"][data-open], [data-slot="popover-content"][data-open]')
    await expect(popup).toBeVisible()
    const before = await gridState(page)
    for (const key of [
      slideListCopy.deleteKey,
      "ArrowRight",
      slideListCopy.openKey,
      "Space",
      "Alt+ArrowRight",
      "ControlOrMeta+d",
      "ControlOrMeta+Equal",
    ]) {
      for (const target of [
        entry(page, 1),
        page.locator("[data-grid-edit] [data-canvas-element]").first(),
        page.locator("[data-grid-viewport]"),
      ]) {
        await target.focus()
        await page.keyboard.press(key)
        expect(await gridState(page), key).toEqual(before)
        await expect(popup).toBeVisible()
      }
    }
    await entry(page, 1).focus()
    await page.keyboard.press("Escape")
    await expect(popup).toBeHidden()
    expect(await gridState(page)).toEqual(before)
  })
}

for (const path of ["right", "ContextMenu"] as const) {
  test(`${path} followed immediately by Escape closes only the slide menu`, async ({ page }) => {
    await openFile(page, sectioned)
    await openGrid(page)
    await entry(page, 1).focus()
    await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText("Hello")
    await expect(entry(page, 2).locator("[data-thumb-paint]")).toContainText("Heat pumps")
    const before = await gridState(page)
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        if (document.querySelector('[role="menu"][data-open]') === null) return
        observer.disconnect()
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
        )
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    if (path === "right") await entry(page, 1).click({ button: "right" })
    else await page.keyboard.press("ContextMenu")
    await expect(page.getByRole("menu")).toBeHidden()
    await expect(entry(page, 1)).toBeFocused()
    expect(await gridState(page)).toEqual(before)
  })
}

test("closing the slide menu rings the slide only when the keyboard closed it", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const menu = page.getByRole("menu")
  const held = () =>
    page.evaluate(() => ({
      slide: document.activeElement?.matches("[data-slide-entry]") ?? false,
      ring: document.activeElement?.matches(":focus-visible") ?? false,
    }))
  const ready = () => expect.poll(() => menu.evaluate((open) => open.contains(document.activeElement))).toBe(true)
  await entry(page, 1).click({ button: "right" })
  await expect(menu).toBeVisible()
  await ready()
  await page.keyboard.press("ArrowDown")
  await menu.getByRole("menuitem").first().click()
  await expect(menu).toBeHidden()
  expect(await held()).toEqual({ slide: true, ring: false })
  await entry(page, 1).focus()
  await page.keyboard.press("ContextMenu")
  await expect(menu).toBeVisible()
  await ready()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  expect(await held()).toEqual({ slide: true, ring: true })
  await entry(page, 1).focus()
  await page.keyboard.press("ContextMenu")
  await expect(menu).toBeVisible()
  await ready()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(menu).toBeHidden()
  expect(await held()).toEqual({ slide: true, ring: true })
})

test("Escape from the canvas closes the zoom menu without clearing the selection", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  await entry(page, 1).focus()
  await page.keyboard.press("ControlOrMeta+a")
  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menu")).toBeVisible()
  await entry(page, 1).focus()
  const before = await gridState(page)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  expect(await gridState(page)).toEqual(before)
})
