import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-hera-analog-lessons.pptx")
const slideWidth = 9_144_000
const emuPerPoint = 12_700

test.use({ viewport: { width: 1600, height: 1000 } })

function points(page: Page): Promise<number> {
  return page.locator("[data-slide-paint]").evaluate(
    (root, emu) => {
      const run = [...root.querySelectorAll<HTMLElement>("[data-run]")].find((each) =>
        (each.textContent ?? "").startsWith("Limiting"),
      )
      if (run === undefined) return Number.NaN
      const scale = root.getBoundingClientRect().width / emu.slideWidth
      return Number.parseFloat(getComputedStyle(run).fontSize) / scale / emu.emuPerPoint
    },
    { slideWidth, emuPerPoint },
  )
}

test("an imported box paints the fit PowerPoint stored until a person types in it, then fits again", async ({
  page,
  decks,
}) => {
  await decks.open(deck)
  const entry = page.locator('[data-slide-entry="7"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await expect.poll(() => points(page)).toBeCloseTo(28 * 0.85, 1)

  const body = page.locator('[data-slide-paint] [contenteditable="true"]', { hasText: "Limiting resupply" })
  await body.focus()
  await page.keyboard.press("Control+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("One more lesson")
  await expect.poll(() => points(page)).toBeLessThan(28 * 0.85 - 1)
})
