import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import {
  accent,
  landNodes,
  landOffScreen,
  landProps,
  openEditor,
  savedNode,
  savedSlides,
  selectedIds,
  spot,
  type Opened,
} from "./editor-deck"
import { covers } from "./gesture"
import { boxOf, card, entry, openGrid, openGroups, viewport, wheelAt, zoomTo, type Point } from "./grid-deck"
import type { Stack } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })
test.describe.configure({ mode: "parallel" })

const slideW = 1920
const slideH = 1080
const control = "Control"
const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const carried = (page: Page) => page.locator("[data-editor-grid] [data-carried]")
const taking = (page: Page) => page.locator("[data-editor-grid] [data-grid-card][data-taking]")

type Saved = { readonly parent: string | null; readonly x: number; readonly y: number }

async function deck(
  page: Page,
  context: Parameters<typeof openEditor>[1],
  stack: Stack,
  layers: { readonly [id: string]: Readonly<Record<string, unknown>> },
) {
  const opened = await openEditor(page, context, stack)
  await landNodes(
    stack,
    opened,
    Object.entries(layers).map(([id, props]) => ({ id, type: "shape" as const, parent: opened.slide, props })),
  )
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await openGrid(page)
  const [first, second] = await savedSlides(stack, opened)
  return { ...opened, first: first!, second: second! }
}

async function onSlide(page: Page, number: number, x: number, y: number): Promise<Point> {
  const frame = await boxOf(card(page, number))
  return { x: frame.x + (frame.width * x) / slideW, y: frame.y + (frame.height * y) / slideH }
}

async function saved(stack: Stack, opened: Opened, id: string): Promise<Saved> {
  const node = await savedNode(stack, opened, id)
  const box = node?.box as { x: number; y: number } | undefined
  const parent = node?.parent as { id: string } | null | undefined
  return { parent: parent?.id ?? null, x: box?.x ?? Number.NaN, y: box?.y ?? Number.NaN }
}

async function enter(page: Page, at: Point) {
  await page.mouse.click(at.x, at.y)
  await expect(live(page)).toHaveCount(1)
}

async function carry(page: Page, from: Point, to: Point, keys: readonly string[] = []) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (const key of keys) await page.keyboard.down(key)
  await page.mouse.move(to.x, to.y, { steps: 12 })
}

async function release(page: Page, keys: readonly string[] = []) {
  await page.mouse.up()
  for (const key of keys) await page.keyboard.up(key)
}

const one = { "c:1": { box: spot(300, 300, 400, 200), fills: accent } }

test("a layer dragged onto another slide lands with the grabbed point under the pointer in one edit, and undo, redo and reload keep it", async ({
  page,
  context,
  stack,
}) => {
  covers("move-to-slide", "undo", "redo")
  const opened = await deck(page, context, stack, one)
  await enter(page, await onSlide(page, 1, 500, 400))
  await carry(page, await onSlide(page, 1, 450, 380), await onSlide(page, 2, 1000, 600), [control])
  await expect(carried(page)).toBeVisible()
  await expect(taking(page)).toHaveCount(1)
  await expect(card(page, 2)).toHaveAttribute("data-taking", "")
  await expect(page.locator("[data-grid-viewport][data-dragging]")).toHaveCount(1)
  await release(page, [control])
  await expect(carried(page)).toHaveCount(0)
  await expect(taking(page)).toHaveCount(0)
  await expect.poll(async () => (await saved(stack, opened, "c:1")).parent).toBe(opened.second)
  const landed = await saved(stack, opened, "c:1")
  expect(Math.abs(landed.x - 850)).toBeLessThanOrEqual(1)
  expect(Math.abs(landed.y - 520)).toBeLessThanOrEqual(1)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(card(page, 2).locator("[data-grid-edit]")).toHaveCount(1)
  expect(await selectedIds(page)).toEqual(["c:1"])

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => saved(stack, opened, "c:1")).toEqual({ parent: opened.first, x: 300, y: 300 })
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await saved(stack, opened, "c:1")).parent).toBe(opened.second)
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  if ((await viewport(page).count()) === 0) await openGrid(page)
  await expect(card(page, 2).locator('[data-node="c:1"]')).toBeVisible()
  await expect(card(page, 1).locator('[data-node="c:1"]')).toHaveCount(0)
})

test("released over empty canvas or cancelled with Escape, the layer goes back and nothing is written", async ({
  page,
  context,
  stack,
}) => {
  covers("deselect")
  const opened = await deck(page, context, stack, one)
  await enter(page, await onSlide(page, 1, 500, 400))
  const room = await boxOf(viewport(page))
  await carry(page, await onSlide(page, 1, 450, 380), { x: room.x + room.width / 2, y: room.y + room.height - 70 })
  await expect(carried(page)).toBeVisible()
  await expect(taking(page)).toHaveCount(0)
  await release(page)
  await expect(carried(page)).toHaveCount(0)
  await expect(card(page, 1).locator('[data-node="c:1"]')).toBeVisible()

  await carry(page, await onSlide(page, 1, 450, 380), await onSlide(page, 2, 1000, 600))
  await expect(taking(page)).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(carried(page)).toHaveCount(0)
  await expect(taking(page)).toHaveCount(0)
  await release(page)
  await expect(live(page)).toHaveCount(1)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  expect(await saved(stack, opened, "c:1")).toEqual({ parent: opened.first, x: 300, y: 300 })
})

test("Alt-drag copies onto the other slide, the original stays, and the copy is selected there", async ({
  page,
  context,
  stack,
}) => {
  covers("duplicate-drag")
  const opened = await deck(page, context, stack, one)
  await enter(page, await onSlide(page, 1, 500, 400))
  const alt = shortcutCopy.chord.other.alt
  await carry(page, await onSlide(page, 1, 450, 380), await onSlide(page, 2, 1000, 600), [alt, control])
  await release(page, [alt, control])
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  const [copy] = await selectedIds(page)
  expect(copy).toBeDefined()
  expect(copy).not.toBe("c:1")
  await expect.poll(async () => (await saved(stack, opened, copy!)).parent).toBe(opened.second)
  expect(await saved(stack, opened, "c:1")).toEqual({ parent: opened.first, x: 300, y: 300 })
})

test("a connector follows when both its ends move, and stays when only one end moves", async ({
  page,
  context,
  stack,
}) => {
  const opened = await deck(page, context, stack, {
    "c:1": { box: spot(300, 300, 300, 200), fills: accent },
    "c:2": { box: spot(900, 300, 300, 200), fills: accent },
    "c:3": {
      box: spot(600, 400, 300, 0),
      geometry: {
        kind: "line",
        start: { node: "c:1", site: "r" },
        end: { node: "c:2", site: "l" },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: accent,
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  })
  await enter(page, await onSlide(page, 1, 450, 400))
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  const second = await onSlide(page, 1, 1050, 400)
  await page.mouse.click(second.x, second.y)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  expect((await selectedIds(page)).toSorted()).toEqual(["c:1", "c:2"])
  await carry(page, await onSlide(page, 1, 450, 400), await onSlide(page, 2, 450, 500), [control])
  await expect(carried(page).locator('[data-node="c:3"]')).toBeAttached()
  await release(page, [control])
  await expect.poll(async () => (await saved(stack, opened, "c:3")).parent).toBe(opened.second)
  expect((await saved(stack, opened, "c:1")).parent).toBe(opened.second)
  expect((await saved(stack, opened, "c:2")).parent).toBe(opened.second)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved(stack, opened, "c:3")).parent).toBe(opened.first)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await enter(page, await onSlide(page, 1, 450, 400))
  await carry(page, await onSlide(page, 1, 450, 400), await onSlide(page, 2, 450, 500), [control])
  await release(page, [control])
  await expect.poll(async () => (await saved(stack, opened, "c:1")).parent).toBe(opened.second)
  expect((await saved(stack, opened, "c:3")).parent).toBe(opened.first)
})

test("another tab deleting the target slide or the carried layer mid-drag wins, and the drop writes nothing", async ({
  page,
  context,
  stack,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const opened = await deck(page, context, stack, {
    ...one,
    "c:2": { box: spot(300, 700, 300, 200), fills: accent },
  })
  await enter(page, await onSlide(page, 1, 500, 400))
  await carry(page, await onSlide(page, 1, 450, 380), await onSlide(page, 2, 1000, 600))
  await expect(taking(page)).toHaveCount(1)
  await landProps(stack, opened, opened.second, { parent: null })
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(1)
  await page.mouse.move((await onSlide(page, 1, 1700, 500)).x + 400, (await onSlide(page, 1, 1700, 500)).y, {
    steps: 3,
  })
  await release(page)
  await expect(carried(page)).toHaveCount(0)
  expect(await saved(stack, opened, "c:1")).toEqual({ parent: opened.first, x: 300, y: 300 })

  await page.getByRole("button", { name: slideListCopy.newSlide, exact: true }).click()
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(2)
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(2)
  const [, third] = await savedSlides(stack, opened)
  await enter(page, await onSlide(page, 1, 450, 800))
  await carry(page, await onSlide(page, 1, 450, 800), await onSlide(page, 2, 1000, 600))
  await expect(taking(page)).toHaveCount(1)
  await landProps(stack, opened, "c:2", { parent: null })
  await expect.poll(async () => (await saved(stack, opened, "c:2")).parent).toBeNull()
  await release(page)
  await expect(carried(page)).toHaveCount(0)
  await expect.poll(async () => (await saved(stack, opened, "c:2")).parent).toBeNull()
  expect((await savedSlides(stack, opened)).includes(third!)).toBe(true)
  expect(await saved(stack, opened, "c:1")).toEqual({ parent: opened.first, x: 300, y: 300 })
  expect(errors).toEqual([])
})

test("held at the canvas edge, a carried layer pans the Grid and stays under the pointer", async ({
  page,
  context,
  stack,
}) => {
  await deck(page, context, stack, one)
  await zoomTo(page, 30)
  await enter(page, await onSlide(page, 1, 500, 400))
  const room = await boxOf(viewport(page))
  const before = await boxOf(card(page, 2))
  await carry(page, await onSlide(page, 1, 450, 380), { x: room.x + room.width - 8, y: room.y + room.height / 2 })
  await expect.poll(async () => (await boxOf(card(page, 2))).x).toBeLessThan(before.x - 200)
  const ghost = await boxOf(carried(page).locator('[data-node="c:1"]'))
  expect(ghost.x).toBeLessThan(room.x + room.width)
  expect(ghost.x + ghost.width).toBeGreaterThan(room.x + room.width - 8)
  await page.keyboard.press("Escape")
  await release(page)
})

for (const zoom of ["fit", 30, 100, 250] as const) {
  test(`at ${zoom === "fit" ? "fit" : `${String(zoom)}%`} after a pan, the drop keeps the grabbed point under the pointer`, async ({
    page,
    context,
    stack,
  }) => {
    const opened = await deck(page, context, stack, { "e:1": { box: spot(1650, 400, 200, 150), fills: accent } })
    if (zoom !== "fit") await zoomTo(page, zoom)
    const room = await boxOf(viewport(page))
    const around = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
    const end = await onSlide(page, 1, slideW, 475)
    const start = await onSlide(page, 2, 0, 475)
    await wheelAt(page, around, { x: (end.x + start.x) / 2 - around.x, y: start.y - around.y })
    await expect
      .poll(async () => Math.round((await onSlide(page, 2, 0, 475)).x))
      .toBe(Math.round(around.x + (start.x - end.x) / 2))
    await enter(page, await onSlide(page, 1, 1750, 475))
    await carry(page, await onSlide(page, 1, 1750, 475), await onSlide(page, 2, 200, 500), [control])
    await release(page, [control])
    await expect.poll(async () => (await saved(stack, opened, "e:1")).parent).toBe(opened.second)
    const landed = await saved(stack, opened, "e:1")
    expect(Math.abs(landed.x - 100)).toBeLessThanOrEqual(1)
    expect(Math.abs(landed.y - 425)).toBeLessThanOrEqual(1)
  })
}

test("right after a wheel zoom, with no pause, the drop reads the camera the wheel painted", async ({
  page,
  context,
  stack,
}) => {
  const opened = await deck(page, context, stack, one)
  await enter(page, await onSlide(page, 1, 500, 400))
  const near = await onSlide(page, 1, 1900, 500)
  for (let step = 0; step < 4; step += 1) await wheelAt(page, near, { x: 0, y: -10 }, { ctrlKey: true })
  await carry(page, await onSlide(page, 1, 450, 380), await onSlide(page, 2, 1000, 600), [control])
  await release(page, [control])
  await expect.poll(async () => (await saved(stack, opened, "c:1")).parent).toBe(opened.second)
  const landed = await saved(stack, opened, "c:1")
  expect(Math.abs(landed.x - 850)).toBeLessThanOrEqual(1)
  expect(Math.abs(landed.y - 520)).toBeLessThanOrEqual(1)
})

test("a layer carried across a 50-slide Grid does not re-render the Grid on every frame", async ({
  page,
  context,
  stack,
}) => {
  await page.addInitScript(() => {
    const counted = window as unknown as { gridRenders: number; commits: number; listProps: unknown }
    counted.gridRenders = 0
    counted.commits = 0
    counted.listProps = null
    ;(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: object }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      isDisabled: false,
      supportsFiber: true,
      inject: () => 1,
      onCommitFiberRoot: () => {
        counted.commits += 1
        const list = document.querySelector("[data-editor-grid] [data-slide-list]")
        if (list === null) return
        const key = Object.keys(list).find((name) => name.startsWith("__reactProps$"))
        const props = key === undefined ? null : (list as unknown as Record<string, unknown>)[key]
        if (props !== counted.listProps) counted.gridRenders += 1
        counted.listProps = props
      },
    }
  })
  const grouped = await openGroups(page, context, stack, [50])
  await landOffScreen(stack, grouped, [
    { id: "c:1", type: "shape", parent: grouped.ids[0]!, props: { box: spot(300, 300, 400, 200), fills: accent } },
  ])
  await expect(card(page, 1).locator('[data-node="c:1"]')).toBeVisible()
  await zoomTo(page, 20)
  const room = await boxOf(viewport(page))
  const around = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  const middle = await onSlide(page, 2, slideW / 2, slideH / 2)
  await wheelAt(page, around, { x: middle.x - around.x, y: middle.y - around.y })
  await expect
    .poll(async () => Math.round((await onSlide(page, 2, slideW / 2, slideH / 2)).x))
    .toBe(Math.round(around.x))
  await enter(page, await onSlide(page, 1, 500, 400))
  const from = await onSlide(page, 1, 450, 380)
  const to = await onSlide(page, 3, 900, 500)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 4, from.y, { steps: 2 })
  const frames = 40
  const before = await page.evaluate(() => {
    const counted = window as unknown as { gridRenders: number; commits: number }
    return { renders: counted.gridRenders, commits: counted.commits }
  })
  for (let step = 1; step <= frames; step += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * step) / frames, from.y + ((to.y - from.y) * step) / frames)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
  }
  const after = await page.evaluate(() => {
    const counted = window as unknown as { gridRenders: number; commits: number }
    return { renders: counted.gridRenders, commits: counted.commits }
  })
  await page.mouse.up()
  expect(after.commits - before.commits).toBeGreaterThan(frames / 2)
  expect(after.renders - before.renders).toBeLessThan(8)
})
