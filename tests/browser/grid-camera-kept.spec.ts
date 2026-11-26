import { expect, type Page } from "@playwright/test"
import { zoomCopy } from "../../apps/web/src/copy/product-copy.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { boxOf, entry, openGrid, openGroups, readout, viewport, wheelAt, zoomTo } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const kept = (page: Page, deck: string) =>
  page.evaluate((key) => localStorage.getItem(key), `airdesign.grid-viewport.${deck}`)

async function reopened(page: Page): Promise<void> {
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await openGrid(page)
}

async function fitChecked(page: Page): Promise<void> {
  await readout(page).click()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
  await page.keyboard.press("Escape")
}

test("pan and zoom are kept for the deck through Slides view and a reload, and another deck opens at fit", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 3])
  const room = await boxOf(viewport(page))
  await wheelAt(page, { x: room.x + 300, y: room.y + 300 }, { x: 0, y: -40 }, { ctrlKey: true })
  await wheelAt(page, { x: room.x + 300, y: room.y + 300 }, { x: 160, y: 170 })
  await expect.poll(() => kept(page, opened.deck)).not.toBeNull()
  const before = await boxOf(entry(page, 1))
  const percent = await readout(page).textContent()
  await page.getByRole("button", { name: slideListCopy.slidesView }).click()
  await expect(viewport(page)).toHaveCount(0)
  await openGrid(page)
  expect(await boxOf(entry(page, 1))).toEqual(before)
  await reopened(page)
  expect(await boxOf(entry(page, 1))).toEqual(before)
  await expect(readout(page)).toHaveText(percent ?? "")
  await page.goto("/s")
  await page.waitForURL((url) => url.pathname !== `/s/${opened.deck}` && url.pathname.startsWith("/s/"))
  await page.locator("[data-editor-ready]").waitFor()
  await openGrid(page)
  await fitChecked(page)
})

test("a deck left at Zoom to fit reopens at Zoom to fit after a pan is fitted away", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [4, 3])
  const fitted = await boxOf(entry(page, 1))
  const room = await boxOf(viewport(page))
  await wheelAt(page, { x: room.x + 300, y: room.y + 300 }, { x: 300, y: 200 })
  await expect.poll(() => kept(page, opened.deck)).not.toBeNull()
  await page.keyboard.press("Shift+Digit1")
  await expect.poll(() => kept(page, opened.deck)).toBeNull()
  await reopened(page)
  expect(await boxOf(entry(page, 1))).toEqual(fitted)
  await fitChecked(page)
})

test("a kept camera on a slide deleted in Slides view reopens on a slide that is left", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 7).click()
  await zoomTo(page, 200)
  await page.getByRole("button", { name: slideListCopy.slidesView }).click()
  const seven = page.locator('[data-slide-entry="7"]')
  await expect(seven).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(seven).toHaveCount(0)
  await openGrid(page)
  await expect(entry(page, 6)).toHaveAttribute("aria-current", "true")
  const room = await boxOf(viewport(page))
  const six = await boxOf(entry(page, 6))
  const middle = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  expect(six.x < middle.x && six.x + six.width > middle.x && six.y < middle.y && six.y + six.height > middle.y).toBe(
    true,
  )
  await expect(readout(page)).toHaveText(/^200%/)
})
