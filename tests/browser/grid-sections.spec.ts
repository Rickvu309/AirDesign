import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { hover } from "./grid-reorder-deck"
import { entry, fixtures, openFile, openGrid, rowNumbers, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a section collapses to its heading, stays collapsed for the deck, and opens again for the slide a person goes to", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  const numbers = page.locator("[data-editor-grid]").getByRole("button", { name: /^Numbers/ })
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(numbers).toHaveAccessibleName("Numbers 2 slides")
  await numbers.click()
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await expect(entry(page, 2)).toHaveCount(0)
  await expect(entry(page, 3)).toHaveCount(0)
  await expect(numbers).toContainText("2 slides")
  await numbers.press(slideListCopy.openKey)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 3)).toBeVisible()
  await numbers.press("Space")
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "false")
  await expect(entry(page, 3)).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAttribute("tabindex", "0")
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await entry(page, 3).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 3)).toBeFocused()
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(numbers).toHaveAttribute("aria-expanded", "true")
})

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1470, height: 923 },
]) {
  test(`Fit shows section names beyond their slide at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openFile(page, join(fixtures, "doe-heat-pumps.pptx"))
    await openGrid(page)
    expect((await rowNumbers(page)).map((row) => row.length)).toEqual([1, 10, 10, 8, 10, 2])
    if (viewport.width === 1470) {
      expect(Number.parseInt(await page.locator("[data-zoom-readout]").innerText(), 10)).toBeGreaterThanOrEqual(7)
    }
    for (const name of ["Introduction", "Appendices"]) {
      const head = page.locator("[data-section-head]").filter({ hasText: name })
      const label = head.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      expect(await label.evaluate((node) => node.clientWidth)).toBeGreaterThanOrEqual(24)
      if (name === "Appendices") expect(await label.evaluate((node) => node.clientWidth >= node.scrollWidth)).toBe(true)
      const bounds = await head.boundingBox()
      expect(bounds?.height).toBeCloseTo(20, 0)
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThan(viewport.width - 47)
    }
  })
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1470, height: 923 },
]) {
  test(`whole sections share a row without truncating their headings at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openFile(page, join(fixtures, "sections-after.pptx"))
    await openGrid(page)
    await expect(page.locator("[data-grid-row]")).toHaveCount(1)
    const heads = page.locator('[data-grid-row-member="0"] [data-section-head]')
    await expect(heads).toHaveCount(2)
    for (const name of ["Opening", "Numbers"]) {
      const label = heads.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      expect(await label.evaluate((node) => node.clientWidth >= node.scrollWidth)).toBe(true)
    }
    const first = await heads.first().boundingBox()
    const next = await heads.last().boundingBox()
    if (first === null || next === null) throw new Error("section headings")
    expect(first.x + first.width).toBeLessThan(next.x)
    expect(first.y).toBeCloseTo(next.y)
  })
}

const heatPumps = join(fixtures, "doe-heat-pumps.pptx")

test("collapsing rows leaves the next heading, removes their controls and refits the grid", async ({ page }) => {
  await openFile(page, heatPumps)
  await openGrid(page)
  const headings = page.locator("[data-section-head]")
  const part = headings.nth(1)
  const following = headings.nth(2)
  const zoom = page.locator("[data-zoom-readout]")
  const expanded = await zoom.innerText()
  await part.click()
  await expect(part).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("[data-grid-row-frame]")).toHaveCount(3)
  await expect(
    page.locator('[data-grid-row-member="1"], [data-grid-row-member="11"], [data-grid-row-member="21"]'),
  ).toHaveCount(0)
  const before = await part.boundingBox()
  const after = await following.boundingBox()
  if (before === null || after === null) throw new Error("section headings")
  expect(after.y - before.y - before.height).toBeCloseTo(24, 0)
  expect(Number.parseFloat(await zoom.innerText())).toBeGreaterThanOrEqual(Number.parseFloat(expanded))
  await part.click()
  await expect(page.locator("[data-grid-row-frame]")).toHaveCount(6)
  await expect(zoom).toHaveText(expanded)
})

test("Tab and arrows skip collapsed slides and the first heading takes focus when all are collapsed", async ({
  page,
}) => {
  await openFile(page, heatPumps)
  await openGrid(page)
  const headings = page.locator("[data-section-head]")
  const stop = page.locator('[data-slide-entry][tabindex="0"]')
  await expect(stop).toHaveAttribute("data-slide-entry", "1")
  await headings.first().click()
  await expect(stop).toHaveAttribute("data-slide-entry", "2")
  await page.keyboard.press("Tab")
  await expect(headings.nth(1)).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(entry(page, 2)).toBeFocused()
  await expect(stop).toHaveCount(1)
  await expect(page.locator("[data-grid-card][data-selected]")).toHaveCount(0)
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await openGrid(page)
  await expect(headings.first()).toHaveAttribute("aria-expanded", "false")
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(headings.first()).toHaveAttribute("aria-expanded", "false")
  await expect(stop).toHaveAttribute("data-slide-entry", "2")

  await entry(page, 29).focus()
  await headings.nth(2).click()
  await entry(page, 29).focus()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 40)).toBeFocused()
  await headings.last().click()
  await expect(stop).toHaveAttribute("data-slide-entry", "2")
  await headings.nth(1).click()
  await expect(stop).toHaveCount(0)
  await expect(headings.first()).toBeFocused()
})

test("the first slide halo leaves six pixels below the heading at 22 percent", async ({ page }) => {
  await openFile(page, heatPumps)
  await openGrid(page)
  await page.locator("[data-zoom-readout]").click()
  const field = page.locator("[data-zoom-field]")
  await field.fill("22")
  await field.press("Enter")
  const card = entry(page, 2).locator("..")
  await expect(card).toHaveAttribute("data-number-placement", "above")
  await entry(page, 2).hover()
  const clearance = await card.evaluate((node) => {
    const halo = node.querySelector("[data-grid-halo]")
    const heading = node.closest("[data-grid-row-member]")?.querySelector("[data-section-head]")
    if (halo === null || heading == null) throw new Error("heading and halo")
    const face = halo.getBoundingClientRect()
    return face.top + Number.parseFloat(getComputedStyle(halo, "::before").top) - heading.getBoundingClientRect().bottom
  })
  expect(clearance).toBeGreaterThanOrEqual(6)
})

async function grabByNumber(page: Page, number: number): Promise<void> {
  const mark = await page
    .locator(`[data-grid-card]:has([data-slide-entry="${number}"]) [data-slide-number]`)
    .boundingBox()
  if (mark === null) throw new Error(`no number ${String(number)}`)
  await page.mouse.move(mark.x + mark.width / 2, mark.y + mark.height / 2)
  await page.mouse.down()
  await page.mouse.move(mark.x + 20, mark.y + 20, { steps: 3 })
}

test("a slide dragged past a collapsed section lands outside its hidden rows", async ({ page }) => {
  await openFile(page, heatPumps)
  await openGrid(page)
  const headings = page.locator("[data-section-head]")
  const part = headings.nth(1)
  const before = await rowNumbers(page)
  await part.click()
  const heading = await part.boundingBox()
  if (heading === null) throw new Error("section heading")
  await grabByNumber(page, 31)
  await page.mouse.move(heading.x + 60, heading.y + heading.height + 34, { steps: 6 })
  await page.mouse.up()
  await expect(part).toHaveAttribute("aria-label", /28 slides$/)
  await grabByNumber(page, 31)
  await hover(page, 1, 0.8)
  await page.mouse.up()
  await expect(headings.first()).toHaveAttribute("aria-label", /2 slides$/)
  await expect(part).toHaveAttribute("aria-expanded", "false")
  await part.click()
  expect((await rowNumbers(page)).slice(1, 4)).toEqual(before.slice(1, 4).map((row) => row.map((number) => number + 1)))
})
