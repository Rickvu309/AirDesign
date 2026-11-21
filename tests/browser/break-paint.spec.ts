import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { decksOn, test } from "./deck-test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-conjunction-assessment.pptx")
const broken = "CA can be performed only against well tracked objects in the catalog"

async function open(page: Page): Promise<void> {
  await decksOn(page).open(deck)
  const entry = page.locator('[data-slide-entry="11"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint]").getByText(broken)).toBeVisible()
  await decksOn(page).ready()
}

async function lines(root: Locator): Promise<{ readonly words: number; readonly block: number }> {
  return root.evaluate((node, wanted) => {
    const block = [...node.querySelectorAll<HTMLElement>("[data-paragraph]")].find((each) =>
      (each.textContent ?? "").startsWith(wanted),
    )
    if (block === undefined) throw new Error("no paragraph")
    const walker = node.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const range = node.ownerDocument.createRange()
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const at = (text.textContent ?? "").indexOf(wanted)
      if (at < 0) continue
      range.setStart(text, at)
      range.setEnd(text, at + wanted.length)
      break
    }
    return { words: range.getBoundingClientRect().height, block: block.getBoundingClientRect().height }
  }, broken)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a paragraph that ends in a line break paints the empty line after it, on the canvas and in its thumbnail", async ({
  page,
}) => {
  await open(page)
  for (const root of [page.locator("[data-slide-paint]"), page.locator('[data-slide-entry="11"] [data-thumb-paint]')]) {
    const { words, block } = await lines(root)
    expect(words).toBeGreaterThan(0)
    expect(block / words).toBeGreaterThan(1.8)
  }
})
