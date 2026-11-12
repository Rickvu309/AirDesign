import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx")
const box = '[data-canvas-element="ppt/slides/slide8.xml#3"]'
const wrapped = `${box} [data-run="1.0"]`

async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(deck)
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
  const entry = page.locator('[data-slide-entry="8"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await page.evaluate(() => document.fonts.ready)
}

async function lineTops(run: Locator): Promise<readonly number[]> {
  return run.evaluate((span) => {
    const range = span.ownerDocument.createRange()
    range.selectNodeContents(span)
    return [...new Set([...range.getClientRects()].map((rect) => Math.round(rect.top * 100) / 100))]
  })
}

async function lineStarts(root: Locator): Promise<readonly string[]> {
  return root.evaluate((node) => {
    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const words = text.textContent ?? ""
      if (!words.startsWith("A parts manufacturer")) continue
      const starts: string[] = []
      let last = Number.NEGATIVE_INFINITY
      for (const word of words.matchAll(/\S+/g)) {
        const range = node.ownerDocument.createRange()
        range.setStart(text, word.index)
        range.setEnd(text, word.index + 1)
        const rect = range.getBoundingClientRect()
        if (rect.top > last + rect.height / 2) starts.push(word[0])
        last = Math.max(last, rect.top)
      }
      return starts
    }
    throw new Error("no paragraph")
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a paragraph breaks its lines at the same words in its thumbnail as on the canvas", async ({ page }) => {
  await open(page)
  const canvas = await lineStarts(page.locator("[data-slide-paint]"))
  expect(canvas.length).toBeGreaterThan(2)
  expect(await lineStarts(page.locator('[data-slide-entry="8"] [data-thumb-paint]'))).toEqual(canvas)
})

test("a Calibri run paints in Carlito, an open font of Calibri's widths, when Calibri is missing", async ({ page }) => {
  await open(page)
  const run = page.locator(wrapped)
  expect(await run.evaluate((span) => getComputedStyle(span).fontFamily)).toMatch(/^"?Calibri"?, "?Carlito"?,/)
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/"/g, "")),
  )
  expect(loaded).toContain("Carlito")
})

test("a paragraph spaced at 90% puts its lines 0.9 of a single line, 1.2 times the size, apart", async ({ page }) => {
  await open(page)
  const run = page.locator(wrapped)
  const size = await run.evaluate((span) => Number.parseFloat(getComputedStyle(span).fontSize))
  const tops = await lineTops(run)
  expect(tops.length).toBeGreaterThan(2)
  for (const [at, top] of tops.slice(1).entries()) {
    expect(Math.abs(top - (tops[at] ?? 0) - size * 1.08)).toBeLessThan(0.5)
  }
})

test("a click on a word on a later line puts the caret in that word, and typing lands there", async ({ page }) => {
  await open(page)
  const run = page.locator(wrapped)
  const target = await run.evaluate((span) => {
    const text = span.firstChild
    if (text === null || text.textContent === null) throw new Error("no text")
    const word = "documented"
    const start = text.textContent.indexOf(word)
    const range = span.ownerDocument.createRange()
    range.setStart(text, start + 3)
    range.setEnd(text, start + 4)
    const rect = range.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, start }
  })
  const tops = await lineTops(run)
  expect(target.y).toBeGreaterThan((tops[1] ?? Number.POSITIVE_INFINITY) - 1)
  await page.mouse.click(target.x, target.y)
  await expect(page.locator(`${box} [contenteditable="true"]`)).toBeFocused()
  const offset = await page.evaluate(() => getSelection()?.anchorOffset ?? -1)
  expect(offset).toBeGreaterThanOrEqual(target.start + 3)
  expect(offset).toBeLessThanOrEqual(target.start + 4)
  await page.keyboard.type("Q")
  await expect(run).toContainText(/docQumented|docuQmented/)
})
