import { expect, type Locator, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { test } from "./api-stack"
import {
  boxOf,
  entry,
  openGroups,
  savedGroups,
  selectedNumbers,
  viewport,
  wheelAt,
  zoomTo,
  type Box,
  type Point,
} from "./grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const button = (page: Page, label: string) => page.locator(`[aria-label="${label}"]`)
const mark = (page: Page, label: string) => button(page, label).locator("[data-add-mark]")
const spot = (page: Page, label: string) => page.locator("[data-add-spot]").filter({ has: button(page, label) })
const between = slideListCopy.addAfter(1)
const farRight = slideListCopy.addAfter(3)
const underMiddle = slideListCopy.addBelow(2)
const underLast = slideListCopy.addBelow(3)

const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
const right = (box: Box) => box.x + box.width
const bottom = (box: Box) => box.y + box.height

function shown(page: Page): Promise<string[]> {
  return page.locator("[data-add-gap], [data-add-group]").evaluateAll((all) =>
    all
      .filter((each) => {
        const style = getComputedStyle(each)
        return style.visibility === "visible" && style.opacity !== "0" && each.getBoundingClientRect().width > 0
      })
      .map((each) => each.getAttribute("aria-label") ?? ""),
  )
}

async function rest(page: Page) {
  const room = await boxOf(viewport(page))
  await page.mouse.move(room.x + room.width / 2, room.y + 4)
}

async function bring(page: Page, target: Locator) {
  await rest(page)
  const room = await boxOf(viewport(page))
  const box = middle(await boxOf(target))
  const aim = middle(room)
  await wheelAt(page, aim, { x: box.x - aim.x, y: box.y - aim.y })
  await expect
    .poll(async () => {
      const now = middle(await boxOf(target))
      return Math.max(Math.abs(now.x - aim.x), Math.abs(now.y - aim.y))
    })
    .toBeLessThan(1)
}

async function point(page: Page, at: Point) {
  await page.mouse.move(at.x, at.y)
}

async function hover(page: Page, label: string): Promise<Box> {
  await bring(page, spot(page, label))
  const zone = await boxOf(spot(page, label))
  await point(page, middle(zone))
  await expect.poll(() => shown(page)).toEqual([label])
  return zone
}

async function plus(page: Page, label: string): Promise<Box> {
  const box = await boxOf(mark(page, label))
  expect(box.width).toBeGreaterThan(23.5)
  expect(box.width).toBeLessThan(24.5)
  expect(box.height).toBeGreaterThan(23.5)
  expect(box.height).toBeLessThan(24.5)
  await expect(mark(page, label).locator("svg")).toBeVisible()
  return box
}

function screenStroke(target: Locator) {
  return target.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("not an element")
    const ratio = element.getBoundingClientRect().width / element.offsetWidth
    const tokens = getComputedStyle(document.documentElement)
    const rect = element.querySelector("rect")
    if (rect === null) {
      return {
        width: parseFloat(getComputedStyle(element).borderTopWidth) * ratio,
        expected: parseFloat(tokens.getPropertyValue("--grid-insertion-line-width")),
        dash: 0,
        expectedDash: 0,
      }
    }
    const style = getComputedStyle(rect)
    return {
      width: parseFloat(style.strokeWidth) * ratio,
      expected: parseFloat(tokens.getPropertyValue("--grid-placeholder-stroke")),
      dash: parseFloat(style.strokeDasharray) * ratio,
      expectedDash: parseFloat(tokens.getPropertyValue("--grid-placeholder-dash")),
    }
  })
}

async function strokeKeepsScreenSize(target: Locator) {
  const stroke = await screenStroke(target)
  expect(stroke.width).toBeCloseTo(stroke.expected, 1)
  expect(stroke.dash).toBeCloseTo(stroke.expectedDash, 1)
}

async function noneAlong(page: Page, from: Point, to: Point) {
  const samples = 12
  for (let step = 0; step <= samples; step += 1) {
    await point(page, {
      x: from.x + ((to.x - from.x) * step) / samples,
      y: from.y + ((to.y - from.y) * step) / samples,
    })
    expect(await shown(page)).toEqual([])
  }
}

async function noneOverSlides(page: Page, numbers: readonly number[]) {
  for (const number of numbers) {
    await bring(page, entry(page, number))
    const slide = await boxOf(entry(page, number))
    await noneAlong(page, { x: slide.x + 4, y: slide.y + slide.height / 2 }, { x: right(slide) - 4, y: slide.y + 4 })
    await point(page, { x: right(slide) - 4, y: slide.y + slide.height / 2 })
    expect(await shown(page)).toEqual([])
  }
}

for (const zoom of ["fit", 16, 60, 150] as const) {
  test(`at ${String(zoom)} each add shows a 24 px plus only at its own spot`, async ({ page, context, stack }) => {
    await openGroups(page, context, stack, [3, 4, 2])
    await zoomTo(page, zoom)
    await rest(page)
    expect(await shown(page)).toEqual([])
    await expect(page.locator("[data-gap-preview]:visible, [data-group-preview]:visible")).toHaveCount(0)

    const gapZone = await hover(page, between)
    const gapMark = await plus(page, between)
    const one = await boxOf(entry(page, 1))
    const two = await boxOf(entry(page, 2))
    expect(middle(gapMark).x).toBeCloseTo((right(one) + two.x) / 2, 0)
    expect(middle(gapMark).y).toBeCloseTo(middle(one).y, 0)
    expect(gapZone.x).toBeGreaterThan(right(one) - 0.5)
    expect(right(gapZone)).toBeLessThan(two.x + 0.5)
    expect(gapZone.height).toBeGreaterThan(Math.min(44, one.height) - 0.5)
    expect(gapZone.height).toBeLessThan(one.height)
    await expect(page.locator("[data-gap-preview]:visible, [data-group-preview]:visible")).toHaveCount(0)

    await hover(page, farRight)
    const endMark = await plus(page, farRight)
    const three = await boxOf(entry(page, 3))
    const column = two.x - right(one)
    expect(middle(endMark).x).toBeCloseTo(right(three) + column / 2, 0)
    const ghost = page.locator("[data-gap-placeholder]:visible")
    await expect(ghost).toHaveCount(1)
    const ghostBox = await boxOf(ghost)
    expect(ghostBox.x).toBeCloseTo(right(three) + column, 0)
    expect(ghostBox.y).toBeCloseTo(three.y, 0)
    expect(ghostBox.width).toBeCloseTo(three.width, 0)
    expect(ghostBox.height).toBeCloseTo(three.height, 0)
    await strokeKeepsScreenSize(ghost)

    const middleZone = await hover(page, underMiddle)
    const middleMark = await plus(page, underMiddle)
    const four = await boxOf(entry(page, 4))
    const seven = await boxOf(entry(page, 7))
    const eight = await boxOf(entry(page, 8))
    expect(middleMark.x).toBeCloseTo(four.x, 0)
    expect(middleZone.width).toBeGreaterThan(43.5)
    expect(middleZone.width).toBeLessThan(four.width / 2)
    const line = page.locator("[data-group-insertion-line]:visible")
    await expect(line).toHaveCount(1)
    await expect(page.locator("[data-group-placeholder]:visible")).toHaveCount(0)
    const lineBox = await boxOf(line)
    expect(lineBox.x).toBeCloseTo(four.x, 0)
    expect(lineBox.width).toBeCloseTo(four.width, 0)
    expect(lineBox.y).toBeCloseTo(middle(middleMark).y, 0)
    expect(lineBox.y).toBeGreaterThan(bottom(seven))
    expect(lineBox.y).toBeLessThan(eight.y)
    await strokeKeepsScreenSize(line)
    await noneAlong(page, { x: right(middleZone) + 4, y: lineBox.y }, { x: right(seven) - 4, y: lineBox.y })

    const lastZone = await hover(page, underLast)
    const lastMark = await plus(page, underLast)
    const nine = await boxOf(entry(page, 9))
    const shownEight = await boxOf(entry(page, 8))
    const ghostRow = page.locator("[data-group-placeholder]:visible")
    await expect(ghostRow).toHaveCount(1)
    const rowBox = await boxOf(ghostRow)
    expect(rowBox.x).toBeCloseTo(shownEight.x, 0)
    expect(rowBox.width).toBeCloseTo(shownEight.width, 0)
    expect(rowBox.height).toBeCloseTo(shownEight.height, 0)
    expect(Math.abs(middle(lastMark).x - middle(rowBox).x)).toBeLessThan(1)
    expect(lastMark.y).toBeGreaterThan(bottom(nine))
    expect(bottom(lastMark)).toBeLessThan(rowBox.y)
    expect(Math.abs(middle(lastZone).x - middle(lastMark).x)).toBeLessThan(1)
    expect(lastZone.width).toBeGreaterThan(43.5)
    expect(lastZone.width).toBeLessThan(shownEight.width / 2)
    await strokeKeepsScreenSize(ghostRow)
    const band = middle(lastMark).y
    await noneAlong(page, { x: shownEight.x + 4, y: band }, { x: lastZone.x - 4, y: band })
    await noneAlong(page, { x: right(lastZone) + 4, y: band }, { x: right(nine) - 4, y: band })

    await noneOverSlides(page, [1, 3, 4, 7, 9])
  })
}

test("the centred plus under the last slide group starts a new group, saves and undoes", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openGroups(page, context, stack, [3, 4, 2])
  const saved = () => savedGroups(stack, opened)
  const start = await saved()
  await zoomTo(page, 60)
  await hover(page, underLast)
  const target = middle(await boxOf(mark(page, underLast)))
  await page.mouse.click(target.x, target.y)
  await expect.poll(async () => (await saved()).map((group) => group.length)).toEqual([3, 4, 2, 1])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual(start)
})

test("a plus keeps 24 px on screen on the frame right after each wheel zoom", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [3, 4, 2])
  await zoomTo(page, 60)
  const zone = await hover(page, between)
  const sizes = await viewport(page).evaluate((element, at: Point) => {
    const marked = document.querySelector(`[data-add-spot]:hover [data-add-mark]`)
    if (marked === null) throw new Error("no hovered plus")
    const widths: number[] = []
    for (const deltaY of [-30, -30, 40, 40, 40, -20]) {
      element.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY,
          ctrlKey: true,
          clientX: at.x,
          clientY: at.y,
          bubbles: true,
          cancelable: true,
        }),
      )
      widths.push(marked.getBoundingClientRect().width, marked.getBoundingClientRect().height)
    }
    return widths
  }, middle(zone))
  for (const size of sizes) {
    expect(size).toBeGreaterThan(23.5)
    expect(size).toBeLessThan(24.5)
  }
})

test("a plus focused by keyboard rings its mark inside the gap, beside its ghost", async ({ page, context, stack }) => {
  await openGroups(page, context, stack, [3, 4, 2])
  await zoomTo(page, 16)
  await entry(page, 3).click()
  await rest(page)
  await page.keyboard.press("Tab")
  await expect(button(page, farRight)).toBeFocused()
  await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(1)
  const ring = await mark(page, farRight).evaluate((element) => {
    const style = getComputedStyle(element)
    const reach = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
    const box = element.getBoundingClientRect()
    const host = getComputedStyle(element.closest("button")!)
    return { shown: style.outlineStyle, host: host.outlineStyle, left: box.left - reach, right: box.right + reach }
  })
  expect(ring.shown).toBe("solid")
  expect(ring.host).toBe("none")
  expect(ring.left).toBeGreaterThan(right(await boxOf(entry(page, 3))))
  expect(ring.right).toBeLessThan((await boxOf(page.locator("[data-gap-placeholder]:visible"))).x)
})

test("a drag from empty canvas beside an add spot draws the slide marquee and adds nothing", async ({
  page,
  context,
  stack,
}) => {
  await openGroups(page, context, stack, [3, 4, 2])
  await zoomTo(page, 16)
  const zone = await hover(page, underMiddle)
  const from = { x: right(zone) + 8, y: middle(zone).y }
  const five = middle(await boxOf(entry(page, 5)))
  await point(page, from)
  expect(await shown(page)).toEqual([])
  await page.mouse.down()
  await page.mouse.move(five.x, five.y, { steps: 6 })
  await expect(page.locator("[data-grid-marquee]")).toBeVisible()
  await expect.poll(() => selectedNumbers(page)).toEqual([4, 5])
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(9)
})
