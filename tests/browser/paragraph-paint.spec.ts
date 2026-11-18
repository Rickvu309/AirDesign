import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx")
const heraDeck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-hera-analog-lessons.pptx")

async function open(page: Page, file = deck): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
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

test("an empty paragraph paints no bullet until someone types in its box, as PowerPoint does", async ({ page }) => {
  await open(page)
  await showSlide(page, 13)
  const body = page.locator('[data-slide-paint] [contenteditable="true"]', { hasText: "Declared by the manufacturer" })
  const emptyBullets = () =>
    body.evaluate((box) =>
      [...box.querySelectorAll<HTMLElement>("[data-paragraph]")]
        .filter((block) => (block.textContent ?? "") === "")
        .map((block) => getComputedStyle(block, "::before").content),
    )
  expect(await emptyBullets()).toEqual(["none", "none"])
  await body.focus()
  expect(await emptyBullets()).toEqual(['"•"', '"•"'])
})

test("a bullet keeps its line as tall as its paragraph's tight line height, as PowerPoint does", async ({ page }) => {
  await open(page, heraDeck)
  await showSlide(page, 7)
  const body = page.locator('[data-slide-paint] [contenteditable="true"]', { hasText: "Limiting resupply" })
  const heights = await body.evaluate((box) => {
    const block = [...box.querySelectorAll<HTMLElement>("[data-paragraph]")].find(
      (each) => (each.textContent ?? "") === "Limiting resupply",
    )
    const run = block?.querySelector<HTMLElement>("[data-run]")
    return {
      bullet: block === undefined ? "" : getComputedStyle(block, "::before").content,
      line: run === null || run === undefined ? 0 : Number.parseFloat(getComputedStyle(run).lineHeight),
      paragraph: block?.getBoundingClientRect().height ?? 0,
    }
  })
  expect(heights.bullet).toBe('"•"')
  expect(heights.line).toBeGreaterThan(0)
  expect(Math.abs(heights.paragraph - heights.line)).toBeLessThan(0.5)
})
