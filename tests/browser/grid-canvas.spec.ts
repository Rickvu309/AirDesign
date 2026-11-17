import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import type { Page } from "@playwright/test"

async function zoomTo(page: Page, percent: number | "fit") {
  await page.locator("[data-zoom-readout]").click()
  if (percent === "fit") await page.getByRole("menuitemradio", { name: zoomCopy.fit, exact: true }).click()
  else {
    await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(percent))
    await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
  }
}
import { expect, test } from "@playwright/test"
import { clean, entry, openFile, openGrid, settled, manySlides } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("edits a slide in Grid view and keeps the text after reopening", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  await entry(page, 1).click()
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await text.fill("Edited on the grid")
  await text.press("Tab")
  await page.reload()
  await settled(page)
  await openGrid(page)
  await entry(page, 1).click()
  await expect(page.locator('[data-grid-edit] [contenteditable="true"]').first()).toHaveText("Edited on the grid")
})

test("keeps slide numbers above the canvas", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const card = await entry(page, 1).boundingBox()
  const number = await page.locator("[data-slide-number]").first().boundingBox()
  expect(card).not.toBeNull()
  expect(number).not.toBeNull()
  expect((number?.y ?? 0) + (number?.height ?? 0)).toBeLessThan(card?.y ?? 0)
})

test("pans beyond the slide layout and zooms without reflowing it", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const first = await entry(page, 1).boundingBox()
  await page.mouse.move(800, 350)
  await page.mouse.wheel(1600, 1800)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.x).toBeLessThan(0)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.y).toBeLessThan(0)
  await page.mouse.wheel(-1600, -1800)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.x).toBeCloseTo(first?.x ?? 0, 0)
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.width).toBeGreaterThan(first?.width ?? 0)
})

for (const count of [7, 50]) {
  test(`fits all ${count} slides inside the visible canvas`, async ({ page }) => {
    await openFile(page, {
      name: "fit.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: await manySlides(count),
    })
    await openGrid(page)
    const room = await page.locator("[data-grid-viewport]").boundingBox()
    const last = await entry(page, count).boundingBox()
    expect(last!.y + last!.height).toBeLessThan(room!.y + room!.height - 24)
    await zoomTo(page, "fit")
    await expect(entry(page, count)).toBeInViewport()
  })
}
test("keeps chrome constant and hides crowded numbers at minimum zoom", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const rim = async () =>
    entry(page, 1).evaluate(
      (el) =>
        (Number.parseFloat(getComputedStyle(el).borderRadius) * el.getBoundingClientRect().width) / el.offsetWidth,
    )
  const initial = await rim()
  await zoomTo(page, 200)
  expect(await rim()).toBeCloseTo(initial, 1)
  await entry(page, 1).focus()
  const focusWidth = await entry(page, 1).evaluate(
    (el) => (Number.parseFloat(getComputedStyle(el).outlineWidth) * el.getBoundingClientRect().width) / el.offsetWidth,
  )
  expect(focusWidth).toBeCloseTo(2, 1)
  await zoomTo(page, 10)
  await expect(page.locator("[data-slide-number]").first()).toBeHidden()
})
test("keeps rows fixed across resize and panel changes", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 923 })
  await openFile(page, {
    name: "rows.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(7),
  })
  await openGrid(page)
  const first = await entry(page, 1).boundingBox()
  const fourth = await entry(page, 4).boundingBox()
  expect(fourth!.y).toBeCloseTo(first!.y)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await zoomTo(page, "fit")
  await expect(entry(page, 7)).toBeInViewport()
  await page.setViewportSize({ width: 1470, height: 923 })
  expect((await entry(page, 4).boundingBox())!.y).toBeCloseTo((await entry(page, 1).boundingBox())!.y)
})
test("selects without opening a side panel", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  await entry(page, 1).click()
  await expect(page.locator("[data-editor-panel]")).toHaveCount(0)
})
test("keeps the selected slide visible when menu and keys zoom", async ({ page }) => {
  await openFile(page, {
    name: "selected.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(7),
  })
  await openGrid(page)
  await entry(page, 7).click()
  await zoomTo(page, 200)
  await expect(entry(page, 7)).toBeInViewport()
  await zoomTo(page, 10)
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect(entry(page, 7)).toBeInViewport()
})

test("centres occupied slide bounds even with one slide", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const card = await page.locator("[data-grid-card]").boundingBox()
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  expect(card!.x + card!.width / 2).toBeCloseTo(room!.x + room!.width / 2, 0)
  expect(card!.y + card!.height / 2).toBeCloseTo(room!.y + room!.height / 2, 0)
})

test("numbers clear the preceding row at fit", async ({ page }) => {
  await openFile(page, { name: "numbers.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  const first = await entry(page, 1).boundingBox()
  const fifth = await page.locator("[data-slide-number]").nth(4).boundingBox()
  expect(fifth!.y).toBeGreaterThan(first!.y + first!.height + 4)
})
