import { join } from "node:path"
import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a long imported section name stays fully readable when expanded and collapsed", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const name = "Part 1: Basic Principles of Heat Pump Operation"
  const head = page.locator("button[data-section-head]").filter({ hasText: name })
  await expect(head).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  for (const expanded of [true, false]) {
    await expect(head).toHaveAttribute("aria-expanded", String(expanded))
    const geometry = await head.evaluate((row) => {
      const label = row.children[1]
      const icon = row.children[0]
      if (!(label instanceof HTMLElement) || icon === undefined) throw new Error("missing section name")
      const text = label.getBoundingClientRect()
      const box = row.getBoundingClientRect()
      const chevron = icon.getBoundingClientRect()
      const badge = row.children[2]?.getBoundingClientRect()
      return {
        overflowX: label.scrollWidth - label.clientWidth,
        overflowY: label.scrollHeight - label.clientHeight,
        insideRow: text.top >= box.top && text.bottom <= box.bottom && text.right <= box.right,
        lines: text.height / Number.parseFloat(getComputedStyle(label).lineHeight),
        chevronOffset: Math.abs(
          chevron.top + chevron.height / 2 - text.top - Number.parseFloat(getComputedStyle(label).lineHeight) / 2,
        ),
        badgeOffset: badge === undefined ? 0 : Math.abs(badge.top - text.top),
      }
    })
    expect(geometry.overflowX).toBeLessThanOrEqual(1)
    expect(geometry.overflowY).toBeLessThanOrEqual(1)
    expect(geometry.insideRow).toBe(true)
    expect(geometry.lines).toBeGreaterThan(1)
    expect(geometry.chevronOffset).toBeLessThanOrEqual(3)
    expect(geometry.badgeOffset).toBeLessThanOrEqual(2)
    if (expanded) {
      await head.click()
      await expect(head).toBeFocused()
    }
  }
  await page.keyboard.press("Space")
  await expect(head).toHaveAttribute("aria-expanded", "true")
})
