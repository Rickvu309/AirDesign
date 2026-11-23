import { expect, type Page } from "@playwright/test"
import { guideWords } from "../../apps/web/src/copy/guide-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { productCopy, tabTitleOf, zoomCopy, zoomToOf } from "../../apps/web/src/copy/product-copy"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { openDoomEditor, savedNode, savedSlides } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).first().boundingBox()
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

const notes = (page: Page) => page.locator("[data-notes-bar] textarea")

test("the Doom editor is the old editor's page: its columns, the slide number, notes and bar, with no top bar", async ({
  page,
  context,
  stack,
}) => {
  await openDoomEditor(page, context, stack)
  await expect(page.locator("header")).toHaveCount(0)

  const left = page.locator("[data-editor-sidebar]")
  await expect(left.getByRole("link", { name: productCopy.goToDecks })).toHaveAttribute("href", /^\/$/)
  await expect(left.getByRole("button", { name: new RegExp(`^${productCopy.renameDeck}`) })).toBeVisible()
  await expect(left.getByRole("button", { name: guideWords.grid, exact: true })).toBeDisabled()
  await expect(left.getByRole("button", { name: slideListCopy.addSlide })).toBeVisible()
  await expect(left.getByText(slideListCopy.newSlide, { exact: true })).toBeVisible()

  const slide = await box(page, "[data-slide-box]")
  const label = await box(page, "[data-slide-label]")
  const bar = await box(page, "[data-notes-bar]")
  const tools = await box(page, `[role="toolbar"]`)
  await expect(page.locator("[data-slide-label]")).toHaveText("1")
  expect(label.y + label.height).toBeLessThanOrEqual(slide.y)
  expect(bar.y).toBeGreaterThan(slide.y + slide.height)
  expect(tools.y).toBeGreaterThan(bar.y + bar.height)
  expect(Math.abs(tools.x + tools.width / 2 - (bar.x + bar.width / 2))).toBeLessThan(2)
  expect(Math.abs(bar.width - slide.width)).toBeLessThan(2)

  const right = page.locator("[data-editor-panel]")
  await expect(right.locator("[data-zoom-readout]")).toBeVisible()
  await expect(right.getByRole("button", { name: presentCopy.present })).toBeVisible()
  await expect(right.getByRole("button", { name: productCopy.exportDeck, exact: true })).toBeEnabled()
  await expect(right.locator("[data-aira-panel]")).toBeVisible()
  await expect(page.locator("[data-zoom-percent]")).toHaveCount(0)
})

test("the canvas rings focus that Tab brought, and never focus a click brought, even after keys", async ({
  page,
  context,
  stack,
}) => {
  await openDoomEditor(page, context, stack)
  const stage = page.locator("[data-doom-stage]")
  await stage.click({ position: { x: 40, y: 40 } })
  await page.keyboard.press("r")
  await page.keyboard.press("ArrowRight")
  await expect(stage).toBeFocused()
  await expect(stage).toHaveCSS("outline-style", "none")
  await page.keyboard.press("Shift+Tab")
  await expect(stage).not.toBeFocused()
  await page.keyboard.press("Tab")
  await expect(stage).toBeFocused()
  await expect(stage).toHaveCSS("outline-style", "solid")
  await expect(stage).toHaveCSS("outline-offset", "-2px")
})

test("the deck's name is renamed in the sidebar, titles the tab, is kept after a reload and shows on the home card", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const deck = "s:1"
  await page.getByRole("button", { name: new RegExp(`^${productCopy.renameDeck}`) }).click()
  const field = page.getByRole("textbox", { name: productCopy.deckName })
  await field.fill("Board update")
  await field.press("Enter")
  await expect.poll(async () => (await savedNode(stack, opened, deck))?.name).toBe("Board update")
  await expect(page).toHaveTitle(tabTitleOf("Board update"))
  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(page.getByRole("button", { name: `${productCopy.renameDeck}: Board update` })).toBeVisible()
  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  const card = page.locator(`[data-deck="${opened.deck}"]`)
  await expect(card.getByRole("heading")).toHaveText("Board update")
})

test("presenter notes belong to their slide and are kept after a reload", async ({ page, context, stack }) => {
  const opened = await openDoomEditor(page, context, stack)
  await notes(page).fill("Open with the number\nthen the plan")
  await page.locator("[data-slide-list]").click({ position: { x: 5, y: 400 } })
  await expect
    .poll(async () => ((await savedNode(stack, opened, opened.slide))?.notes as { chars: string } | undefined)?.chars)
    .toBe("Open with the number\nthen the plan")

  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator('[data-slide-entry][aria-current="true"]')).toHaveAttribute("data-slide-entry", "2")
  await expect(notes(page)).toHaveValue("")
  await page.locator('[data-slide-entry="1"]').click()
  await expect(notes(page)).toHaveValue("Open with the number\nthen the plan")

  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(notes(page)).toHaveValue("Open with the number\nthen the plan")
})

test("New slide offers the designed starting slides, and the plus adds a slide with a title", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const painted = page.locator("[data-slide-box] [data-node]")
  const menu = page.getByRole("button", { name: "Choose a layout for the new slide" })
  const choose = async (name: string) => {
    await menu.click()
    await page.getByRole("menuitem", { name, exact: true }).click()
  }
  await menu.click()
  await expect(page.getByRole("menuitem")).toHaveText(Object.values(doomEditorCopy.slideStarts))
  await page.keyboard.press("Escape")
  await choose(doomEditorCopy.slideStarts.blank)
  await expect(painted).toHaveCount(0)
  await choose(doomEditorCopy.slideStarts.title)
  await expect(painted).toHaveCount(2)
  await choose(doomEditorCopy.slideStarts.kpis)
  expect(await painted.count()).toBeGreaterThan(5)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(painted).toHaveCount(1)
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(5)
})

test("the zoom menu in the right column zooms the slide and goes back to fit", async ({ page, context, stack }) => {
  await openDoomEditor(page, context, stack)
  const slide = page.locator("[data-slide-box]")
  const fitted = (await box(page, "[data-slide-box]")).width
  expect(fitted).toBeLessThan(1920)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomToOf(100) }).click()
  await expect.poll(async () => Math.round((await slide.boundingBox())?.width ?? 0)).toBe(1920)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomCopy.fit }).click()
  await expect.poll(async () => Math.round((await slide.boundingBox())?.width ?? 0)).toBe(Math.round(fitted))
})

test("Agent opens at 360 and Design at 240, the slide fits each, and a reload opens the panel the deck last showed", async ({
  page,
  context,
  stack,
}) => {
  await openDoomEditor(page, context, stack)
  const column = page.locator("[data-editor-panel]")
  const readout = page.locator("[data-zoom-readout]")
  await expect(column.locator("[data-aira-panel]")).toBeVisible()
  expect((await box(page, "[data-editor-panel]")).width).toBe(360)
  const slideBefore = (await box(page, "[data-slide-box]")).width
  const zoomBefore = await readout.textContent()

  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  expect((await box(page, "[data-editor-panel]")).width).toBe(240)
  await expect.poll(async () => (await box(page, "[data-slide-box]")).width).toBeGreaterThan(slideBefore)
  await expect(readout).not.toHaveText(zoomBefore ?? "")

  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  await page.getByRole("button", { name: doomEditorCopy.panelAgent, exact: true }).click()
  await expect(column.locator("[data-aira-panel]")).toBeVisible()
  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(page.locator("[data-design-panel]")).toHaveCount(0)
  await expect(column.locator("[data-aira-panel]")).toBeVisible()
})

test("Present shows the deck full screen and Escape returns to the editor with the button focused", async ({
  page,
  context,
  stack,
}) => {
  await openDoomEditor(page, context, stack)
  const button = page.getByRole("button", { name: presentCopy.present, exact: true })
  await button.click()
  await expect(page.locator("[data-present-show] [data-present-slide]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(button).toBeFocused()
})
