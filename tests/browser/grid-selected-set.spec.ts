import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { test } from "./api-stack"
import { openSaved, picked, roomOf } from "./grid-reorder-deck"
import { entry, rowSizes } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function selectThree(page: Page) {
  await page.locator("[data-slide-number]").nth(0).click()
  await page
    .locator("[data-slide-number]")
    .nth(2)
    .click({ modifiers: ["Shift"] })
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(3)
}

test("reorders the selected slides together and restores the server rows with one Undo", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 7, rowSizes(7))
  const originalRows = await saved.rows()
  await selectThree(page)
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(saved.order).toEqual(picked(saved.ids, [4, 1, 2, 3, 5, 6, 7]))
  await expect.poll(saved.rows).toEqual([picked(saved.ids, [4, 1, 2, 3]), saved.ids.slice(4)])
  await expect(entry(page, 4)).toHaveAttribute("data-selected", "")
  await page.getByRole("button", { name: undoCopy.undoNamed.order, exact: true }).click()
  await expect.poll(saved.order).toEqual(saved.ids)
  await expect.poll(saved.rows).toEqual(originalRows)
})

test("pointer and keyboard menus keep a selected set and disable Open", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 7, rowSizes(7))
  await selectThree(page)
  const menu = page.getByRole("menu")
  const labels = slideListCopy.setActions(3)
  for (const key of ["pointer", "ContextMenu"]) {
    if (key === "pointer") await entry(page, 2).click({ button: "right" })
    else await entry(page, 2).press(key)
    await expect(menu).toBeVisible()
    await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(3)
    await expect(menu.getByRole("menuitem", { name: new RegExp(slideListCopy.open) })).toBeDisabled()
    await expect(menu.getByRole("menuitem", { name: new RegExp(labels.up) })).toBeDisabled()
    await expect(menu.getByRole("menuitem", { name: new RegExp(labels.down) })).toBeEnabled()
    await page.keyboard.press("Escape")
  }
  await entry(page, 4).press("Shift+F10")
  await expect(page.locator("[data-slide-entry][data-selected]")).toHaveCount(1)
  await expect(menu.getByRole("menuitem", { name: new RegExp(slideListCopy.open) })).toBeEnabled()
})

test("Design shows the slide count without a single slide Background control", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 7, rowSizes(7))
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await selectThree(page)
  const panel = page.locator("[data-design-panel]")
  await expect(panel).toContainText(slideListCopy.selected(3))
  await expect(panel.getByRole("heading", { name: designCopy.background, exact: true })).toHaveCount(0)
  await entry(page, 4).click()
  await expect(panel.getByRole("heading", { name: designCopy.background, exact: true })).toBeVisible()
})

test("Zoom to selection centers the element and repeats the same viewport", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 7, true)
  await entry(page, 1).locator("[data-thumb-node]").first().click()
  const element = page.locator("[data-grid-edit] [data-canvas-element]").first()
  await expect(element).toBeVisible()
  const room = await roomOf(page)
  const framed = async () => {
    const box = (await element.boundingBox())!
    expect(box.x + box.width / 2).toBeCloseTo(room.x + room.width / 2, 0)
    expect(box.y + box.height / 2).toBeCloseTo(room.y + room.height / 2, 0)
    expect(box.width).toBeLessThanOrEqual(room.width - 95)
    expect(box.height).toBeLessThanOrEqual(room.height - 95)
    return box
  }
  await page.keyboard.press("Shift+Digit2")
  const first = await framed()
  await page.keyboard.press("Shift+Digit2")
  expect(await framed()).toEqual(first)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitem", { name: zoomCopy.selection }).click()
  expect(await framed()).toEqual(first)
})

test("Zoom to selection frames the text box during text editing", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 7, rowSizes(7))
  await entry(page, 1).locator("[data-thumb-node]").first().dblclick()
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await expect(text).toBeFocused()
  const room = await roomOf(page)
  const element = page.locator("[data-grid-edit] [data-canvas-element]").first()
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitem", { name: zoomCopy.selection }).click()
  const box = (await element.boundingBox())!
  expect(box.x + box.width / 2).toBeCloseTo(room.x + room.width / 2, 0)
  expect(box.y + box.height / 2).toBeCloseTo(room.y + room.height / 2, 0)
})

test("repeated selection fit keeps slides in different section rows steady", async ({ page, context, stack }) => {
  await openSaved(page, context, stack, 7, true)
  await page.locator("[data-slide-number]").first().click()
  await page
    .locator("[data-slide-number]")
    .last()
    .click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+Digit2")
  const before = await Promise.all([entry(page, 1).boundingBox(), entry(page, 7).boundingBox()])
  await page.keyboard.press("Shift+Digit2")
  expect(await Promise.all([entry(page, 1).boundingBox(), entry(page, 7).boundingBox()])).toEqual(before)
})
