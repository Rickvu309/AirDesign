import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-hera-analog-lessons.pptx")
const slideWidth = 9_144_000
const emuPerPoint = 12_700

test.use({ viewport: { width: 1600, height: 1000 } })

async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(deck)
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

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
}) => {
  await open(page)
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
