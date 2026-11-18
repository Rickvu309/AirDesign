import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { blankAt, centre, crossed, marquee, selectedNumbers, type Point } from "./grid-marquee-deck.ts"
import { boxOf, canvas, grab, hover, panOf, roomOf, zoomTo } from "./grid-reorder-deck.ts"
import { entry, fixtures, manySlides, openFile, openGrid, rowNumbers } from "./slide-grid-deck.ts"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const screen = "/screens/s41-05-editor-grid-wrapped"
const handle = (page: Page, row: number) => page.getByRole("button", { name: slideListCopy.moveRow(row), exact: true })

async function openWrapped(page: Page): Promise<void> {
  await page.goto(screen)
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
}

async function lengths(page: Page): Promise<number[]> {
  return (await rowNumbers(page)).map((row) => row.length)
}

function origins(page: Page): Promise<number[]> {
  return page
    .locator("[data-origin]")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-origin"))))
}

async function place(page: Page, target: Locator, x: number, y: number): Promise<void> {
  const host = canvas(page)
  const room = await roomOf(page)
  for (let step = 0; step < 40; step += 1) {
    const box = await target.boundingBox()
    if (box === null) throw new Error("missing target")
    const dx = box.x + box.width / 2 - x
    const dy = box.y + box.height / 2 - y
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return
    await host.dispatchEvent("wheel", {
      deltaX: Math.sign(dx) * Math.min(220, Math.abs(dx)),
      deltaY: Math.sign(dy) * Math.min(220, Math.abs(dy)),
      deltaMode: 0,
      clientX: room.x + room.width / 2,
      clientY: room.y + room.height / 2,
    })
  }
  throw new Error("could not place the target")
}

async function bring(page: Page, target: Locator): Promise<void> {
  const host = canvas(page)
  for (let step = 0; step < 40; step += 1) {
    const box = await target.boundingBox()
    const room = await roomOf(page)
    if (box === null) throw new Error("missing target")
    const dx = box.x + box.width / 2 - (room.x + room.width / 2)
    const dy = box.y + box.height / 2 - (room.y + room.height / 2)
    if (Math.abs(dx) < room.width / 4 && Math.abs(dy) < room.height / 4) return
    await host.dispatchEvent("wheel", {
      deltaX: Math.sign(dx) * 280,
      deltaY: Math.sign(dy) * 280,
      clientX: room.x + room.width / 2,
      clientY: room.y + room.height / 2,
    })
  }
  throw new Error("could not pan to the target")
}

test("a stored row longer than the column count wraps onto closer lines and keeps one name", async ({ page }) => {
  await openWrapped(page)
  expect(await lengths(page)).toEqual([1, 28, 10, 2])
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-section-head]")).toHaveCount(0)
  await expect(page.locator("[data-slide-group]").nth(1)).toHaveAccessibleName(/^Part 1:/)
  const firstLine = await boxOf(page, 2)
  const secondLine = await boxOf(page, 12)
  const nextGroup = await boxOf(page, 30)
  expect(secondLine.y - firstLine.y).toBeLessThan(nextGroup.y - (await boxOf(page, 22)).y)
  expect(secondLine.y - firstLine.y).toBeLessThan(firstLine.y - (await boxOf(page, 1)).y)
})

test("one handle sits on the wrapped group, and the add control is only under its last line", async ({ page }) => {
  await openWrapped(page)
  await zoomTo(page, 25)
  await bring(page, handle(page, 2))
  await expect(page.locator("[data-row-handle]")).toHaveCount(4)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  const line = await boxOf(page, 2)
  const next = await boxOf(page, 12)
  const adds = await page
    .locator("[data-add-row]")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().y))
  expect(adds.filter((y) => y > line.y && y < next.y)).toEqual([])
  const below = page.getByRole("button", { name: slideListCopy.addBelow(2), exact: true })
  await bring(page, below)
  const last = await boxOf(page, 22)
  const following = await boxOf(page, 30)
  const button = await below.boundingBox()
  if (button === null) throw new Error("add below")
  expect(button.y).toBeGreaterThan(last.y)
  expect(button.y).toBeLessThan(following.y)
  const between = page
    .locator("[data-grid-card]")
    .filter({ has: entry(page, 11) })
    .locator("[data-gap-insert]")
  const end = page
    .locator("[data-grid-card]")
    .filter({ has: entry(page, 29) })
    .locator("[data-gap-insert]")
  await expect(between).toHaveAttribute("data-gap-insert", "between")
  await expect(end).toHaveAttribute("data-gap-insert", "end")
  await bring(page, between)
  await between.hover()
  await page.getByRole("button", { name: slideListCopy.addAfter(11), exact: true }).click()
  expect(await lengths(page)).toEqual([1, 29, 10, 2])
  const room = await roomOf(page)
  await place(page, entry(page, 12), room.x + 240, room.y + 240)
  await expect(entry(page, 12).locator("[data-origin]")).toHaveAttribute("data-origin", "41")
  await place(page, entry(page, 13), room.x + 420, room.y + 240)
  await expect(entry(page, 13).locator("[data-origin]")).toHaveAttribute("data-origin", "11")
})

test("hovering the handle tints every line as one band and nothing animates", async ({ page }) => {
  await openWrapped(page)
  await zoomTo(page, 25)
  const grip = handle(page, 2)
  await bring(page, grip)
  await grip.hover()
  const members = page.locator("[data-wrapped][data-row-tint]")
  await expect(members).toHaveCount(28)
  const paint = await members
    .locator("[data-grid-halo]")
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity))
  expect(paint).toEqual(Array.from({ length: 28 }, () => "0"))
  const band = page.locator("[data-group-band]")
  await expect(band).toHaveCSS("opacity", "1")
  const motion = await band.evaluate((node) => ({
    duration: getComputedStyle(node).transitionDuration,
    running: node.getAnimations().length,
  }))
  expect(motion).toEqual({ duration: "0s", running: 0 })
  await zoomTo(page, 12)
  await expect(page.locator('[data-grid-row="1"]')).not.toHaveAttribute("data-row-blocked", "")
  await expect(grip).toBeEnabled()
  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator('[data-grid-row="1"]')).toHaveAttribute("data-row-blocked", "")
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
})

test("dragging the handle moves every line of the group", async ({ page }) => {
  test.setTimeout(60_000)
  await openWrapped(page)
  await zoomTo(page, 12)
  const room = await roomOf(page)
  const anchor = entry(page, 1)
  await place(page, anchor, room.x + 180, room.y + 80)
  const grip = handle(page, 2)
  const origin = await grip.boundingBox()
  const head = await anchor.boundingBox()
  if (origin === null || head === null) throw new Error("handle")
  const x = origin.x + origin.width / 2
  expect(x).toBeGreaterThan(room.x)
  expect(origin.y).toBeGreaterThan(room.y)
  expect(origin.y + origin.height).toBeLessThan(room.y + room.height)
  await page.mouse.move(x, origin.y + origin.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, head.y - 28, { steps: 8 })
  await expect(page.locator("[data-drop-bar][data-row-drop]")).toHaveAttribute("data-drop-place", "1")
  await page.mouse.up()
  expect(await lengths(page)).toEqual([28, 1, 10, 2])
  await place(page, entry(page, 1), room.x + 240, room.y + 160)
  await expect(entry(page, 1).locator("[data-origin]")).toHaveAttribute("data-origin", "1")
})

test("Alt+ArrowDown on the handle moves the whole group later", async ({ page }) => {
  await openWrapped(page)
  await zoomTo(page, 25)
  const grip = handle(page, 2)
  await bring(page, grip)
  await grip.focus()
  await grip.press("Alt+ArrowDown")
  await expect(page.locator("[data-announcer]")).toHaveText("Moved slide group 2 to position 3")
  expect(await lengths(page)).toEqual([1, 10, 28, 2])
  const room = await roomOf(page)
  await place(page, entry(page, 2), room.x + 240, room.y + 200)
  await expect(entry(page, 2).locator("[data-origin]")).toHaveAttribute("data-origin", "29")
  await place(page, entry(page, 12), room.x + 240, room.y + 200)
  await expect(entry(page, 12).locator("[data-origin]")).toHaveAttribute("data-origin", "1")
  await place(page, entry(page, 39), room.x + 240, room.y + 200)
  await expect(entry(page, 39).locator("[data-origin]")).toHaveAttribute("data-origin", "28")
})

test("dragging a slide from the first line to the third reorders it inside the group", async ({ page }) => {
  await openWrapped(page)
  await grab(page, 2)
  await hover(page, 24, 0.75)
  const bar = page.locator("[data-drop-bar]")
  await expect(bar).toBeVisible()
  await expect(bar).toHaveAttribute("data-drop-place", "25")
  const motion = await page.locator("[data-grid-card]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      transform: getComputedStyle(node).transform,
      duration: getComputedStyle(node).transitionDuration,
      running: node.getAnimations().length,
    })),
  )
  expect(motion.every((item) => item.transform === "none" && item.duration === "0s" && item.running === 0)).toBe(true)
  await page.mouse.up()
  expect(await lengths(page)).toEqual([1, 28, 10, 2])
  const ids = await origins(page)
  expect(ids.slice(1, 29).toSorted((left, right) => left - right)).toEqual(
    Array.from({ length: 28 }, (_, index) => index + 1),
  )
  expect(ids[1]).not.toBe(1)
  expect(ids.indexOf(1)).toBeGreaterThan(ids.indexOf(23))
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(4)
  await expect(groups.nth(0)).toHaveAccessibleName("Introduction")
  await expect(groups.nth(1)).toHaveAccessibleName(/^Part 1:/)
  await expect(groups.nth(2)).toHaveAccessibleName(/^Part 2:/)
  await expect(groups.nth(3)).toHaveAccessibleName("Appendices")
})

test.describe("live slide aside", () => {
  test.use({ reducedMotion: "no-preference" })

  test("dragging a slide across a wrapped line moves the other slides aside", async ({ page }) => {
    await openWrapped(page)
    await grab(page, 2)
    await hover(page, 24, 0.75)
    await expect(page.locator("[data-drop-bar]")).toBeHidden()
    await expect
      .poll(async () =>
        page
          .locator("[data-grid-card]")
          .evaluateAll((nodes) => nodes.some((node) => getComputedStyle(node).transform !== "none")),
      )
      .toBe(true)
    await page.mouse.up()
    expect(await lengths(page)).toEqual([1, 28, 10, 2])
    const ids = await origins(page)
    expect(ids[1]).not.toBe(1)
    expect(ids.indexOf(1)).toBeGreaterThan(ids.indexOf(23))
  })
})

test("a slide dropped on a later line joins that group, and the start of the group is the only before drop", async ({
  page,
}) => {
  await openWrapped(page)
  await grab(page, 41)
  await hover(page, 12, 0.8)
  await page.mouse.up()
  expect(await lengths(page)).toEqual([1, 29, 10, 1])
  const joined = await origins(page)
  expect(joined.slice(1, 30)).toContain(40)
  expect(joined[1]).not.toBe(40)
  await page.reload()
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-slide-group]")).toHaveCount(4)
  await grab(page, 41)
  await hover(page, 2, 0.2)
  await page.mouse.up()
  expect(await lengths(page)).toEqual([1, 29, 10, 1])
  expect((await origins(page))[1]).toBe(40)
})

test("Fit, Zoom to selection, remembered pan, arrows, marquee and skip follow the wrapped lines", async ({ page }) => {
  await openWrapped(page)
  await zoomTo(page, 25)
  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator("[data-zoom-readout]")).not.toHaveText(/^25/)
  const room = await roomOf(page)
  const top = await boxOf(page, 1)
  const bottom = await boxOf(page, 41)
  expect(top.y).toBeGreaterThanOrEqual(room.y - 1)
  expect(bottom.y + bottom.height).toBeLessThanOrEqual(room.y + room.height + 1)
  const before = (await boxOf(page, 22)).width
  await entry(page, 22).click()
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => (await boxOf(page, 22)).width).toBeGreaterThan(before + 20)
  await zoomTo(page, 100)
  await canvas(page).dispatchEvent("wheel", { deltaX: 180, deltaY: 220, clientX: 400, clientY: 400 })
  await page.waitForTimeout(300)
  const held = await panOf(page)
  await page.reload()
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect.poll(() => panOf(page)).toEqual(held)
  await page.keyboard.press("Shift+Digit1")
  await expect(entry(page, 2)).toBeVisible()
  await entry(page, 2).focus()
  await page.keyboard.press("ArrowDown")
  await expect(entry(page, 12)).toBeFocused()
  const from = await blankBeside(page, 29)
  const to = await centre(page, 2)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await expect(marquee(page)).toBeVisible()
  const expected = await crossed(page, from, to)
  expect(expected).toEqual(expect.arrayContaining([2, 12]))
  await expect.poll(() => selectedNumbers(page)).toEqual(expected)
  await page.mouse.up()
  await entry(page, 1).click()
  await entry(page, 12).click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.skip, exact: true }).click()
  await expect(entry(page, 12)).toHaveAttribute("data-slide-skipped", "true")
  await expect(
    page
      .locator("[data-grid-card]")
      .filter({ has: entry(page, 12) })
      .locator("[data-slide-skip-mark]"),
  ).toHaveCount(1)
})

test("a deck whose slide groups already fit one line draws no wrap", async ({ page }) => {
  await openFile(page, {
    name: "twenty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(20, [10, 10]),
  })
  await openGrid(page)
  expect(await lengths(page)).toEqual([10, 10])
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  const first = await boxOf(page, 1)
  const last = await boxOf(page, 10)
  expect(last.y).toBeCloseTo(first.y, 0)
})

test("an imported section longer than a line is one slide group drawn on wrapped lines", async ({ page }) => {
  await openFile(page, join(fixtures, "doe-heat-pumps.pptx"))
  await openGrid(page)
  expect(await lengths(page)).toEqual([1, 28, 10, 2])
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-section-head]")).toHaveCount(0)
  await expect(page.locator("[data-slide-group]").nth(1)).toHaveAccessibleName(/^Part 1:/)
})

async function blankBeside(page: Page, number: number): Promise<Point> {
  const box = await boxOf(page, number)
  return blankAt(page, { x: box.x + box.width + 36, y: box.y + box.height / 2 })
}
