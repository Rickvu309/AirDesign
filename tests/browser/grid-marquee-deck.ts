import { expect, type Page } from "@playwright/test"
import { boxOf, roomOf } from "./grid-reorder-deck"

export type Point = { readonly x: number; readonly y: number }

export function marquee(page: Page) {
  return page.locator("[data-grid-marquee]")
}

export function selectedNumbers(page: Page): Promise<number[]> {
  return page
    .locator("[data-slide-entry][data-selected]")
    .evaluateAll((cards) => cards.map((card) => Number(card.getAttribute("data-slide-entry"))))
}

export async function blankAt(page: Page, point: Point): Promise<Point> {
  const room = await roomOf(page)
  expect(point.x).toBeGreaterThan(room.x + 60)
  expect(point.x).toBeLessThan(room.x + room.width - 60)
  expect(point.y).toBeGreaterThan(room.y + 60)
  expect(point.y).toBeLessThan(room.y + room.height - 60)
  const blank = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)
    return (
      target !== null &&
      target.closest("[data-grid-viewport]") !== null &&
      target.closest("[data-grid-card], [data-group-head], [data-add-group], [data-group-handle]") === null
    )
  }, point)
  expect(blank).toBe(true)
  return point
}

export async function belowRight(page: Page, number: number): Promise<Point> {
  const box = await boxOf(page, number)
  return blankAt(page, { x: box.x + box.width + 60, y: box.y + box.height + 60 })
}

export async function centre(page: Page, number: number): Promise<Point> {
  const box = await boxOf(page, number)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export function crossed(page: Page, from: Point, to: Point): Promise<number[]> {
  return page.evaluate(
    ({ from, to }) => {
      const left = Math.min(from.x, to.x)
      const right = Math.max(from.x, to.x)
      const top = Math.min(from.y, to.y)
      const bottom = Math.max(from.y, to.y)
      return [...document.querySelectorAll<HTMLElement>("[data-slide-entry]")]
        .filter((card) => {
          const box = card.getBoundingClientRect()
          return box.left <= right && box.right >= left && box.top <= bottom && box.bottom >= top
        })
        .map((card) => Number(card.dataset.slideEntry))
        .sort((one, two) => one - two)
    },
    { from, to },
  )
}

export async function pick(page: Page, ...numbers: number[]) {
  const labels = page.locator("[data-slide-number]")
  await labels.nth(numbers[0]! - 1).click()
  for (const number of numbers.slice(1)) await labels.nth(number - 1).click({ modifiers: ["ControlOrMeta"] })
  await expect.poll(() => selectedNumbers(page)).toEqual(numbers.toSorted((one, two) => one - two))
}
