import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

const sectioned = join(process.cwd(), "scripts/pptx-fixtures/sections-before.pptx")
const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

async function addSlides(page: Page, count: number): Promise<void> {
  const slides = page.locator("[data-slide-entry]")
  const before = await slides.count()
  for (let added = 1; added <= count; added += 1) {
    await page.getByRole("button", { name: "Add slide" }).click()
    await expect(slides).toHaveCount(before + added)
  }
}

test("two Alt+ArrowDown presses move the same slide twice, and the focus ring stays on it", async ({ page, decks }) => {
  await decks.open()
  await addSlides(page, 2)
  await entry(page, 1).click()
  await expect(entry(page, 1)).toContainText("Hello")
  await page.keyboard.press("Alt+ArrowDown")
  await expect(entry(page, 2)).toContainText("Hello")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Alt+ArrowDown")
  await expect(entry(page, 3)).toContainText("Hello")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("Alt+ArrowUp")
  await expect(entry(page, 2)).toContainText("Hello")
  await expect(entry(page, 2)).toBeFocused()
})

test("a duplicate moves focus to the copy, so the next duplicate copies the copy", async ({ page, decks }) => {
  await decks.open()
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press(duplicate)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 3)).toBeFocused()
})

test("a new slide takes focus, and a delete leaves focus on the slide that becomes current, never on the body", async ({
  page,
  decks,
}) => {
  await decks.open()
  await addSlides(page, 2)
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await entry(page, 1).focus()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(entry(page, 1)).toBeFocused()
})

test("a slide moved into a collapsed section opens it and keeps focus, across the section headings", async ({
  page,
  decks,
}) => {
  await decks.open(sectioned)
  await entry(page, 1).click()
  await addSlides(page, 1)
  await expect(page.locator("[data-slide-item]")).toHaveCount(3)
  const opening = page.locator("[data-group-head]").first()
  await opening.click()
  await expect(opening).toHaveAttribute("aria-expanded", "false")
  await entry(page, 3).click()
  await page.keyboard.press("Alt+ArrowUp")
  await expect(opening).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Alt+ArrowUp")
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 1)).toBeFocused()
})

test("a slide row hugs the New slide button: its thumbnail ends on the button's edge and a hover tints it", async ({
  page,
  decks,
}) => {
  await decks.open()
  await addSlides(page, 1)
  await entry(page, 1).click()
  const row = await page.locator("[data-new-slide-layouts]").locator("..").boundingBox()
  const band = await entry(page, 1).boundingBox()
  const thumb = await entry(page, 1).locator("[data-slide-card]").boundingBox()
  if (row === null || band === null || thumb === null) throw new Error("the slide rail is not laid out")
  const right = (box: { x: number; width: number }) => box.x + box.width
  expect(right(thumb)).toBe(right(row))
  expect(row.x - band.x).toBe(right(band) - right(row))
  expect(right(band) - right(thumb)).toBe(thumb.y - band.y)
  expect(row.height).toBe(28)
  await expect(page.locator("[data-new-slide-layouts]")).toHaveCSS("font-weight", "400")
  const tint = () => entry(page, 2).evaluate((item) => getComputedStyle(item).backgroundColor)
  const resting = await tint()
  await entry(page, 2).hover()
  expect(await tint()).not.toBe(resting)
  await page.getByRole("button", { name: "Add slide" }).hover()
  expect(
    await page.getByRole("button", { name: "Add slide" }).evaluate((item) => getComputedStyle(item).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)")
})
