import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import { boxOf, centre, chip, entry, openGroups, said, selectedNumbers, viewport, type Point } from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const marquee = (page: Page) => page.locator("[data-grid-marquee]")

async function blankAt(page: Page, point: Point): Promise<Point> {
  const room = await boxOf(viewport(page))
  expect(point.x).toBeGreaterThan(room.x + 60)
  expect(point.x).toBeLessThan(room.x + room.width - 60)
  expect(point.y).toBeGreaterThan(room.y + 60)
  expect(point.y).toBeLessThan(room.y + room.height - 60)
  const blank = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)
    return target?.closest("[data-grid-viewport]") != null && target.closest("[data-grid-card]") === null
  }, point)
  expect(blank).toBe(true)
  return point
}

async function belowRight(page: Page, number: number): Promise<Point> {
  const box = await boxOf(entry(page, number))
  return blankAt(page, { x: box.x + box.width + 60, y: box.y + box.height + 60 })
}

function crossed(page: Page, from: Point, to: Point): Promise<number[]> {
  return page.evaluate(
    ({ from, to }) => {
      const [left, right] = [Math.min(from.x, to.x), Math.max(from.x, to.x)]
      const [top, bottom] = [Math.min(from.y, to.y), Math.max(from.y, to.y)]
      return [...document.querySelectorAll<HTMLElement>("[data-editor-grid] [data-slide-entry]")]
        .filter((each) => {
          const box = each.getBoundingClientRect()
          return box.left <= right && box.right >= left && box.top <= bottom && box.bottom >= top
        })
        .map((each) => Number(each.dataset.slideEntry))
        .sort((one, two) => one - two)
    },
    { from, to },
  )
}

async function pick(page: Page, ...numbers: number[]): Promise<void> {
  await entry(page, numbers[0]!).click()
  for (const number of numbers.slice(1)) await entry(page, number).click({ modifiers: ["ControlOrMeta"] })
  await expect.poll(() => selectedNumbers(page)).toEqual(numbers.toSorted((one, two) => one - two))
}

async function press(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
}

test("a drag on empty canvas selects every slide it crosses across slide groups, live", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await pick(page, 1)
  const before = await said(page).textContent()
  const from = await belowRight(page, 7)
  const to = await centre(page, 2)
  const halfway = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  await press(page, from, halfway)
  await expect(marquee(page)).toBeVisible()
  await expect(viewport(page)).toHaveAttribute("data-marquee", "")
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, halfway))
  await page.mouse.move(to.x, to.y, { steps: 6 })
  const expected = await crossed(page, from, to)
  expect(expected).toEqual(expect.arrayContaining([2, 6, 7]))
  await expect.poll(() => selectedNumbers(page)).toEqual(expected)
  const look = await marquee(page).evaluate((box) => {
    const style = getComputedStyle(box)
    const { x, y, width } = box.getBoundingClientRect()
    return { fill: style.backgroundColor, moving: document.getAnimations().length, x, y, width }
  })
  expect(look.fill).not.toBe("rgba(0, 0, 0, 0)")
  expect(look.moving).toBe(0)
  expect(look.x).toBeCloseTo(to.x, 0)
  expect(look.y).toBeCloseTo(to.y, 0)
  expect(look.width).toBeCloseTo(from.x - to.x, 0)
  await expect(said(page)).toHaveText(before ?? "")
  await page.mouse.up()
  await expect(marquee(page)).toHaveCount(0)
  await expect(said(page)).toHaveText(slideListCopy.selected(expected.length))
  await expect(chip(page)).toHaveText(slideListCopy.selected(expected.length))
  await expect(page.locator("[data-slide-entry][data-selected]:focus")).toHaveCount(1)
})

test("Shift-drag adds to the selection, and a slide the drag leaves again goes back to how it was", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  const six = await centre(page, 6)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await press(page, from, six)
  await expect
    .poll(() => selectedNumbers(page))
    .toEqual([...new Set([1, 2, ...(await crossed(page, from, six))])].sort())
  const seven = await centre(page, 7)
  await page.mouse.move(seven.x, seven.y, { steps: 6 })
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2, 7])
  await page.mouse.up()
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect(said(page)).toHaveText(slideListCopy.selected(3))
  expect(await selectedNumbers(page)).toEqual([1, 2, 7])
})

test("a press on empty canvas under the drag threshold clears the selection as a click does", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await pick(page, 2, 3)
  const from = await belowRight(page, 7)
  await press(page, from, { x: from.x + 2, y: from.y + 2 })
  await expect(marquee(page)).toHaveCount(0)
  await page.mouse.up()
  await expect.poll(() => selectedNumbers(page)).toEqual([])
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
})

test("Escape mid-drag puts the selection back, and the release that follows changes nothing", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  const six = await centre(page, 6)
  await press(page, from, six)
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, six))
  await page.keyboard.press("Escape")
  await expect(marquee(page)).toHaveCount(0)
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await page.mouse.move(from.x, from.y, { steps: 3 })
  await page.mouse.up()
  expect(await selectedNumbers(page)).toEqual([1, 2])
  await expect(chip(page)).toHaveText(slideListCopy.selected(2))
})

test("a lost window ends the drag like Escape and puts the selection back", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [4, 3])
  await pick(page, 1, 2)
  const from = await belowRight(page, 7)
  const six = await centre(page, 6)
  await press(page, from, six)
  await expect.poll(() => selectedNumbers(page)).toEqual(await crossed(page, from, six))
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(marquee(page)).toHaveCount(0)
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2])
  await page.mouse.up()
  expect(await selectedNumbers(page)).toEqual([1, 2])
})

test("the rectangle pans the canvas at its edge and stays anchored to where it started", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  const room = await boxOf(viewport(page))
  const from = await blankAt(page, { x: room.x + room.width - 120, y: room.y + 100 })
  const start = await boxOf(entry(page, 1))
  await press(page, from, { x: room.x + room.width / 2, y: room.y + room.height - 8 })
  await expect.poll(async () => start.y - (await boxOf(entry(page, 1))).y).toBeGreaterThan(80)
  const held = await page.evaluate(() => {
    const first = document.querySelector("[data-editor-grid] [data-slide-entry='1']")!.getBoundingClientRect()
    const box = document.querySelector("[data-grid-marquee]")!.getBoundingClientRect()
    return { first: first.y, top: box.top, right: box.right }
  })
  expect(held.top).toBeCloseTo(from.y + held.first - start.y, 0)
  expect(held.right).toBeCloseTo(from.x, 0)
  await page.mouse.up()
  await expect(marquee(page)).toHaveCount(0)
  expect((await selectedNumbers(page)).length).toBeGreaterThan(0)
})

test("a drag that crosses no slide takes the ring away, says so, and Select all still works", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [4, 3])
  await expect.poll(() => selectedNumbers(page)).toEqual([1])
  const from = await belowRight(page, 7)
  const to = { x: from.x + 30, y: from.y + 20 }
  expect(await crossed(page, from, to)).toEqual([])
  await press(page, from, to)
  await expect(marquee(page)).toHaveCount(1)
  await page.mouse.up()
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
  expect(await selectedNumbers(page)).toEqual([])
  await page.keyboard.press("ControlOrMeta+a")
  await expect.poll(() => selectedNumbers(page)).toEqual([1, 2, 3, 4, 5, 6, 7])
})

test("a drag keeps to the slides under it when another tab deletes an earlier slide mid-drag", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [7])
  const four = await boxOf(entry(page, 4))
  const target = await centre(page, 4)
  await page.mouse.move(four.x + 10, four.y + four.height + 4)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })
  await expect.poll(() => selectedNumbers(page)).toEqual([4])
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const result = await stack.post(
    doomRoutes.edit.path,
    {
      deck: opened.deck,
      edit: {
        once: "marquee-remove-earlier",
        author: { kind: "person", id: "other-tab" },
        writes: [{ node: opened.ids[0], prop: "parent", value: null }],
      },
    },
    opened.cookie,
  )
  expect(result.json.ok).toBe(true)
  await expect(entry(page, 7)).toHaveCount(0)
  await page.mouse.move(target.x + 2, target.y)
  await page.mouse.up()
  expect(await selectedNumbers(page)).toEqual([4])
})
