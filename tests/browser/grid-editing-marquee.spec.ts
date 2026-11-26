import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { accent, landNodes, openEditor, savedNode, selectedIds, spot, type Opened } from "./editor-deck"
import { covers } from "./gesture"
import { boxOf, card, entry, openGrid, viewport, wheelAt, zoomTo, type Point } from "./grid-deck"
import type { Stack } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })
test.describe.configure({ mode: "parallel" })

const slideW = 1920
const slideH = 1080
const placed = {
  "m:1": spot(1100, 150, 300, 150),
  "m:2": spot(1500, 150, 300, 150),
  "m:3": spot(1100, 750, 300, 150),
} as const
const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const box = (page: Page) => live(page).locator("[data-marquee]")
const painted = (page: Page, id: string) => page.locator(`[data-editor-grid] [data-node="${id}"]`)
const ghost = (page: Page) => page.locator("[data-drag-ghost]")
const dragging = (page: Page) => page.locator("[data-grid-viewport][data-dragging]")

async function threeLayers(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack): Promise<Opened> {
  const opened = await openEditor(page, context, stack)
  await landNodes(
    stack,
    opened,
    Object.entries(placed).map(([id, at]) => ({
      id,
      type: "shape",
      parent: opened.slide,
      props: { box: at, fills: accent },
    })),
  )
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await openGrid(page)
  await expect(painted(page, "m:3")).toBeVisible()
  return opened
}

async function onSlide(page: Page, number: number, x: number, y: number): Promise<Point> {
  const frame = await boxOf(card(page, number))
  return { x: frame.x + (frame.width * x) / slideW, y: frame.y + (frame.height * y) / slideH }
}

async function press(page: Page, from: Point) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
}

async function glide(page: Page, to: Point, steps: number) {
  await page.mouse.move(to.x, to.y, { steps })
}

async function enter(page: Page, id: string) {
  await painted(page, id).click()
  await expect(live(page)).toHaveCount(1)
  expect(await selectedIds(page)).toEqual([id])
}

async function savedBoxes(stack: Stack, opened: Opened) {
  return Promise.all(Object.keys(placed).map(async (id) => (await savedNode(stack, opened, id))?.box))
}

async function centreOn(page: Page, number: number, x: number, y: number) {
  const room = await boxOf(viewport(page))
  const around = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  const at = await onSlide(page, number, x, y)
  await wheelAt(page, around, { x: at.x - around.x, y: at.y - around.y })
  await expect.poll(async () => Math.round((await onSlide(page, number, x, y)).x)).toBe(Math.round(around.x))
}

test("a drag on the live slide's blank paint selects the layers the box crosses as it grows, Shift adds, Escape restores, and a still click picks the slide", async ({
  page,
  context,
  stack,
}) => {
  covers("marquee")
  const opened = await threeLayers(page, context, stack)
  const before = await savedBoxes(stack, opened)
  await enter(page, "m:1")

  await press(page, await onSlide(page, 1, 1000, 80))
  await glide(page, await onSlide(page, 1, 1450, 320), 6)
  await expect(box(page)).toBeVisible()
  await expect.poll(() => selectedIds(page)).toEqual(["m:1"])
  await glide(page, await onSlide(page, 1, 1560, 320), 4)
  await expect.poll(() => selectedIds(page)).toEqual(["m:1", "m:2"])
  await expect(dragging(page)).toHaveCount(0)
  await expect(ghost(page)).toHaveCount(0)
  await page.mouse.up()
  await expect(box(page)).toHaveCount(0)
  await expect(live(page)).toHaveCount(1)
  expect(await selectedIds(page)).toEqual(["m:1", "m:2"])

  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await press(page, await onSlide(page, 1, 1000, 1020))
  await glide(page, await onSlide(page, 1, 1200, 850), 6)
  await page.mouse.up()
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  expect((await selectedIds(page)).toSorted()).toEqual(["m:1", "m:2", "m:3"])

  await press(page, await onSlide(page, 1, 1000, 1020))
  await glide(page, await onSlide(page, 1, 1200, 850), 6)
  await expect.poll(() => selectedIds(page)).toEqual(["m:3"])
  await page.keyboard.press("Escape")
  await expect(box(page)).toHaveCount(0)
  await expect(live(page)).toHaveCount(1)
  expect((await selectedIds(page)).toSorted()).toEqual(["m:1", "m:2", "m:3"])
  await glide(page, await onSlide(page, 1, 1300, 700), 3)
  await page.mouse.up()
  expect((await selectedIds(page)).toSorted()).toEqual(["m:1", "m:2", "m:3"])

  const blank = await onSlide(page, 1, 1000, 1020)
  await page.mouse.click(blank.x, blank.y)
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "true")
  await expect(entry(page, 1)).toBeFocused()
  expect(await savedBoxes(stack, opened)).toEqual(before)
})

test("a layer drag never lifts its slide, empty canvas keeps the slide box, and a slide that is not live still drags", async ({
  page,
  context,
  stack,
}) => {
  covers("move")
  const opened = await threeLayers(page, context, stack)
  await enter(page, "m:1")
  const scale = (await boxOf(card(page, 1))).width / slideW
  const from = await onSlide(page, 1, 1250, 225)
  await press(page, from)
  await page.mouse.move(from.x + 60, from.y, { steps: 6 })
  await expect(dragging(page)).toHaveCount(0)
  await expect(ghost(page)).toHaveCount(0)
  await page.mouse.up()
  await expect
    .poll(async () => ((await savedNode(stack, opened, "m:1"))?.box as { x: number }).x)
    .toBeCloseTo(1100 + 60 / scale, -1)

  const room = await boxOf(viewport(page))
  const second = await boxOf(card(page, 2))
  await press(page, { x: second.x + second.width + 24, y: room.y + room.height - 8 })
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 2)).toHaveAttribute("data-selected", "true")
  await expect(entry(page, 1)).not.toHaveAttribute("data-selected", "true")

  await enter(page, "m:1")
  await press(page, { x: second.x + second.width / 2, y: second.y + second.height * 0.85 })
  await page.mouse.move(second.x + second.width / 2 - 40, second.y + second.height * 0.85, { steps: 6 })
  await expect(dragging(page)).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(dragging(page)).toHaveCount(0)
  await page.mouse.up()
})

for (const zoom of ["fit", 30, 100, 250] as const) {
  test(`at ${zoom === "fit" ? "fit" : `${String(zoom)}%`} after a pan, the box selects exactly the layers it crosses`, async ({
    page,
    context,
    stack,
  }) => {
    await threeLayers(page, context, stack)
    if (zoom !== "fit") await zoomTo(page, zoom)
    await centreOn(page, 1, 1300, 240)
    await enter(page, "m:1")
    await press(page, await onSlide(page, 1, 1020, 100))
    await glide(page, await onSlide(page, 1, 1550, 330), 6)
    await page.mouse.up()
    expect(await selectedIds(page)).toEqual(["m:1", "m:2"])
    await press(page, await onSlide(page, 1, 1450, 100))
    await glide(page, await onSlide(page, 1, 1600, 330), 6)
    await page.mouse.up()
    expect(await selectedIds(page)).toEqual(["m:2"])
  })
}

test("right after a wheel zoom, with no pause, the box reads the camera the wheel painted", async ({
  page,
  context,
  stack,
}) => {
  covers("zoom-in")
  await threeLayers(page, context, stack)
  await enter(page, "m:1")
  const near = await onSlide(page, 1, 1500, 240)
  for (let step = 0; step < 6; step += 1) await wheelAt(page, near, { x: 0, y: -12 }, { ctrlKey: true })
  await press(page, await onSlide(page, 1, 1450, 100))
  await glide(page, await onSlide(page, 1, 1600, 330), 6)
  await page.mouse.up()
  expect(await selectedIds(page)).toEqual(["m:2"])
})
