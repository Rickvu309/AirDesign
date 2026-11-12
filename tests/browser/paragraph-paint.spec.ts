import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx")

async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(deck)
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
}

async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a numbered list paints its numbers outside the editable words", async ({ page }) => {
  await open(page)
  await showSlide(page, 17)
  const painted = await page.locator("[data-slide-paint]").evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("[data-paragraph]")].map((block) => ({
      bullet: getComputedStyle(block, "::before").content,
      hang: block.style.textIndent,
      words: block.textContent ?? "",
    })),
  )
  const numbers = painted.filter((row) => row.bullet === '"1."' || row.bullet === '"2."' || row.bullet === '"3."')
  expect(numbers.map((row) => row.bullet)).toEqual(['"1."', '"2."', '"3."'])
  expect(numbers.every((row) => row.hang.startsWith("-"))).toBe(true)
  expect(
    numbers.every((row) => !row.words.startsWith("1.") && !row.words.startsWith("2.") && !row.words.startsWith("3.")),
  ).toBe(true)
})

test("an underlined run paints its line", async ({ page }) => {
  await open(page)
  await showSlide(page, 10)
  const lined = await page
    .locator("[data-slide-paint]")
    .evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>("[data-run]")].some(
        (run) => run.style.textDecoration.includes("underline") && (run.textContent ?? "").includes("readily"),
      ),
    )
  expect(lined).toBe(true)
})
