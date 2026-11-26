import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy.ts"
import { presentCopy } from "../../apps/web/src/copy/present-copy.ts"
import { zoomCopy } from "../../apps/web/src/copy/product-copy.ts"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { boxOf, entry, inside, openGroups, percent, readout, viewport, zoomTo } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const width = async (page: Parameters<typeof entry>[0]) => Math.round((await boxOf(entry(page, 1))).width)

test("the zoom menu takes a typed percent and steps in and out, and Shift+0 goes to 100%", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await zoomTo(page, 37)
  expect(await width(page)).toBe(Math.round(1920 * 0.37))
  await readout(page).click()
  await page.getByRole("menuitem", { name: zoomCopy.zoomIn }).click()
  await expect(readout(page)).toHaveText(/^50%/)
  expect(await width(page)).toBe(960)
  await readout(page).click()
  await page.getByRole("menuitem", { name: zoomCopy.zoomOut }).click()
  await expect(readout(page)).toHaveText(/^25%/)
  await zoomTo(page, 1)
  expect(await width(page)).toBe(19)
  await page.keyboard.press("Shift+Digit0")
  await expect(readout(page)).toHaveText(/^100%/)
  expect(await width(page)).toBe(1920)
  await page.keyboard.press("ControlOrMeta+Minus")
  await expect(readout(page)).toHaveText(/^75%/)
})

test("Shift+2 zooms to the selected slides, Shift+1 fits the deck, and the menu does both", async ({
  page,
  context,
  stack,
}) => {
  covers("zoom-fit", "zoom-selection")
  await openGroups(page, context, stack, [4, 3])
  const room = await boxOf(viewport(page))
  await entry(page, 7).click()
  await page.keyboard.press("Shift+Digit2")
  const seventh = await boxOf(entry(page, 7))
  expect(Math.max(room.width - seventh.width, room.height - seventh.height)).toBeGreaterThanOrEqual(96)
  expect(Math.min(room.width - seventh.width, room.height - seventh.height)).toBeLessThan(200)
  expect(await inside(entry(page, 7), viewport(page))).toBe(true)
  await expect(entry(page, 6)).not.toBeInViewport({ ratio: 0.5 })
  await page.keyboard.press("Shift+Digit1")
  for (const number of [1, 4, 5, 7]) expect(await inside(entry(page, number), viewport(page))).toBe(true)
  await readout(page).click()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
  await page.keyboard.press("Escape")
  await entry(page, 2).click()
  await entry(page, 3).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await readout(page).click()
  await page.getByRole("menuitem", { name: zoomCopy.selection }).click()
  for (const number of [2, 3]) expect(await inside(entry(page, number), viewport(page))).toBe(true)
  for (const number of [1, 4]) expect(await inside(entry(page, number), viewport(page))).toBe(false)
  await readout(page).click()
  await page.getByRole("menuitemradio", { name: zoomCopy.fit }).click()
  for (const number of [1, 4, 5, 7]) expect(await inside(entry(page, number), viewport(page))).toBe(true)
})

async function centred(page: Parameters<typeof entry>[0], number: number): Promise<boolean> {
  const [box, room] = [await boxOf(entry(page, number)), await boxOf(viewport(page))]
  const x = box.x + box.width / 2 - (room.x + room.width / 2)
  const y = box.y + box.height / 2 - (room.y + room.height / 2)
  return Math.abs(x) < 1 && Math.abs(y) < 1
}

test("a menu or key zoom keeps the selected slide on screen", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 7).click()
  await zoomTo(page, 200)
  expect(await centred(page, 7)).toBe(true)
  await zoomTo(page, 10)
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect.poll(() => percent(page)).toBe(25)
  expect(await inside(entry(page, 7), viewport(page))).toBe(true)
  await page.keyboard.press("Shift+Digit0")
  await expect.poll(() => percent(page)).toBe(100)
  expect(await centred(page, 7)).toBe(true)
})

test("at a chosen zoom opening the side panel keeps the selected slide on screen, and moves nothing it does not clip", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  const panel = page.getByRole("button", { name: editorCopy.sidePanel, exact: true })
  await entry(page, 4).click()
  await page.keyboard.press("Shift+Digit2")
  await zoomTo(page, 10)
  const kept = await boxOf(entry(page, 4))
  const wide = await boxOf(viewport(page))
  await panel.click()
  await expect.poll(async () => (await boxOf(viewport(page))).width).toBeLessThan(wide.width - 200)
  expect(await boxOf(entry(page, 4))).toEqual(kept)
  expect(await percent(page)).toBe(10)
  await panel.click()
  await expect.poll(async () => (await boxOf(viewport(page))).width).toBe(wide.width)
  await entry(page, 4).click()
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(() => percent(page)).toBeGreaterThan(10)
  const filled = await percent(page)
  await panel.click()
  await expect.poll(() => percent(page)).toBeLessThan(filled)
  expect(await inside(entry(page, 4), viewport(page))).toBe(true)
})

test("zoom keys pressed during a show leave the Grid camera as it was", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [4, 3])
  await entry(page, 1).click()
  const before = await percent(page)
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown).toHaveAttribute("data-present-slide", "1")
  await page.keyboard.press("Space")
  await expect(shown).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("Shift+Digit0")
  await page.keyboard.press("Shift+Digit2")
  await page.keyboard.press("Escape")
  await expect(shown).toHaveCount(0)
  expect(await percent(page)).toBe(before)
})
