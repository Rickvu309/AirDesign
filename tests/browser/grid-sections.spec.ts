import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { entry, fixtures, openFile, openGrid, settled } from "./slide-grid-deck"

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
  test(`section markers share one row without overlap at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openFile(page, join(fixtures, "sections-after.pptx"))
    await openGrid(page)
    const heads = page.locator("[data-grid-row]").first().locator("[data-section-head]")
    await expect(heads).toHaveCount(2)
    for (const name of ["Opening", "Numbers"]) {
      const label = heads.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      expect(await label.evaluate((node) => node.clientWidth >= node.scrollWidth)).toBe(true)
    }
    const first = await heads.first().boundingBox()
    const next = await heads.last().boundingBox()
    if (first === null || next === null) throw new Error("section headings")
    expect(first.y).toBeCloseTo(next.y)
    expect(first.x + first.width).toBeLessThan(next.x)
  })
}
