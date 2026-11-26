import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { openEditor, savedSlides } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const tops = (page: Page) => entries(page).evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().top))
const numbers = (page: Page) =>
  page
    .locator("[data-slide-entry] [data-slide-number]")
    .evaluateAll((all) => all.map((each) => [each.textContent, Math.round(each.getBoundingClientRect().top)]))
const resting = (page: Page) =>
  entries(page).evaluateAll((rows) =>
    rows.every((row) => !row.hasAttribute("data-slide-held") && getComputedStyle(row).transform === "none"),
  )

async function hold(page: Page, from: number, to: number) {
  const start = await entry(page, from).boundingBox()
  const end = await entry(page, to).boundingBox()
  if (start === null || end === null) throw new Error("a slide row is not on screen")
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 })
}

test("a dragged slide follows the pointer while the others part and the numbers stay in place, saves on release, and Escape puts it back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const saved = () => savedSlides(stack, opened)
  for (const count of [2, 3, 4]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(entries(page)).toHaveCount(count)
  }
  await expect.poll(async () => (await saved()).length).toBe(4)
  const [one, two, three, four] = await saved()
  await expect.poll(() => resting(page)).toBe(true)
  const [first = 0, second = 0, third = 0, fourth = 0] = await tops(page)
  const numbered = await numbers(page)

  await hold(page, 4, 1)
  await expect(entry(page, 4)).toHaveAttribute("data-slide-held", "")
  await expect.poll(() => tops(page)).toEqual([second, third, fourth, first])
  expect(await numbers(page)).toEqual(numbered)
  expect(await saved()).toEqual([one, two, three, four])
  await page.mouse.up()
  await expect.poll(saved).toEqual([four, one, two, three])
  await expect.poll(() => resting(page)).toBe(true)
  expect(await tops(page)).toEqual([first, second, third, fourth])
  expect(await numbers(page)).toEqual(numbered)

  await entry(page, 3).click()
  await hold(page, 2, 4)
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect.poll(() => resting(page)).toBe(true)
  expect(await saved()).toEqual([four, one, two, three])
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
})
