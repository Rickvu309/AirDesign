import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { landNodes, openEditor, savedNode, type Opened } from "./editor-deck"
import { boxOf, card, openGrid, viewport, wheelAt, zoomTo, type Point } from "./grid-deck"
import { layer, type Stack } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })
test.describe.configure({ mode: "parallel" })

const slideW = 1920
const slideH = 1080
const layerBox = { x: 200, y: 600, w: 800, h: 300 }
const corner = { x: layerBox.x + layerBox.w, y: layerBox.y + layerBox.h }
const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const outline = (page: Page) => live(page).locator("[data-selection-outline]")

type Chrome = { readonly stroke: number; readonly handle: number; readonly font: number }

function chromeOf(scope: Locator): Promise<Chrome> {
  return scope.locator("[data-canvas-overlay]").evaluate((svg) => {
    const ratio = (shape: SVGGraphicsElement) => shape.getBoundingClientRect().width / shape.getBBox().width
    const found = <T extends SVGGraphicsElement>(selector: string) => {
      const shape = svg.querySelector<T>(selector)
      if (shape === null) throw new Error(`no ${selector}`)
      return shape
    }
    const edge = found("[data-selection-outline]")
    const pill = found("[data-size-label] rect")
    const words = found<SVGTextElement>("[data-size-label] text")
    return {
      stroke: Number.parseFloat(getComputedStyle(edge).strokeWidth) * ratio(edge),
      handle: found('[data-grip="bottom-right"]').getBoundingClientRect().width,
      font: Number.parseFloat(getComputedStyle(words).fontSize) * ratio(pill),
    }
  })
}

function sameAsSlides(grid: Chrome, slides: Chrome, label: string) {
  expect(Math.abs(grid.stroke - slides.stroke), `${label}: frame stroke ${String(grid.stroke)}`).toBeLessThan(0.5)
  expect(Math.abs(grid.handle - slides.handle), `${label}: handle ${String(grid.handle)}`).toBeLessThan(0.5)
  expect(Math.abs(grid.font - slides.font), `${label}: size label ${String(grid.font)}`).toBeLessThan(0.5)
}

async function opened(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack) {
  const deck = await openEditor(page, context, stack)
  await landNodes(stack, deck, [{ id: "t:1", type: "shape", parent: deck.slide, props: layer("Hello grid") }])
  const painted = page.locator('[data-slide-box] [data-node="t:1"]')
  await expect(painted).toBeVisible()
  const box = await boxOf(painted)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", "t:1")
  const slides = await chromeOf(page.locator("[data-canvas-stage]"))
  await openGrid(page)
  return { deck, slides }
}

async function screenOf(page: Page, point: Point): Promise<Point> {
  const frame = await boxOf(card(page, 1))
  return { x: frame.x + (frame.width * point.x) / slideW, y: frame.y + (frame.height * point.y) / slideH }
}

async function bring(page: Page, point: Point): Promise<void> {
  const room = await boxOf(viewport(page))
  const around = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  const at = await screenOf(page, point)
  await wheelAt(page, around, { x: at.x - around.x, y: at.y - around.y })
  await expect
    .poll(async () => {
      const shown = await screenOf(page, point)
      return Math.hypot(shown.x - around.x, shown.y - around.y)
    })
    .toBeLessThan(1)
}

async function selectInGrid(page: Page): Promise<void> {
  const at = await screenOf(page, { x: layerBox.x + layerBox.w / 2, y: layerBox.y + layerBox.h / 2 })
  await page.mouse.click(at.x, at.y)
  await expect(outline(page)).toHaveAttribute("data-selection-outline", "t:1")
}

async function resizeFromEdge(page: Page, stack: Stack, deck: Opened, width: number): Promise<number> {
  const handle = await boxOf(live(page).locator('[data-grip="bottom-right"]'))
  const scale = (await boxOf(card(page, 1))).width / slideW
  const from = { x: handle.x + handle.width - 0.5, y: handle.y + handle.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(from.x + 100, from.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Control")
  const grown = width + 100 / scale
  await expect
    .poll(async () => ((await savedNode(stack, deck, "t:1"))?.box as { w?: number } | undefined)?.w ?? 0, {
      message: `the handle grabbed at its edge did not resize by 100/${String(scale)}`,
    })
    .toBeCloseTo(grown, 0)
  return grown
}

for (const zoom of ["fit", 30, 100, 250] as const) {
  test(`the selection chrome in Grid at ${zoom === "fit" ? "fit" : `${String(zoom)}%`} keeps its Slides view size, and a handle grabbed at its edge resizes by distance / scale`, async ({
    page,
    context,
    stack,
  }) => {
    const { deck, slides } = await opened(page, context, stack)
    if (zoom !== "fit") await zoomTo(page, zoom)
    await bring(page, { x: layerBox.x + layerBox.w / 2, y: layerBox.y + layerBox.h / 2 })
    await selectInGrid(page)
    await bring(page, corner)
    sameAsSlides(await chromeOf(live(page)), slides, String(zoom))
    await resizeFromEdge(page, stack, deck, layerBox.w)
  })
}

test("the selection chrome keeps its Slides view size right after a wheel zoom, before the camera rests", async ({
  page,
  context,
  stack,
}) => {
  const { deck, slides } = await opened(page, context, stack)
  await zoomTo(page, 100)
  await bring(page, { x: layerBox.x + layerBox.w / 2, y: layerBox.y + layerBox.h / 2 })
  await selectInGrid(page)
  await bring(page, corner)
  await page.clock.install()
  const before = (await boxOf(card(page, 1))).width
  const at = await screenOf(page, corner)
  for (let step = 0; step < 4; step += 1) await wheelAt(page, at, { x: 0, y: -10 }, { ctrlKey: true })
  await expect.poll(async () => (await boxOf(card(page, 1))).width).toBeGreaterThan(before * 1.2)
  sameAsSlides(await chromeOf(live(page)), slides, "mid zoom in")
  const grown = await resizeFromEdge(page, stack, deck, layerBox.w)
  for (let step = 0; step < 8; step += 1) await wheelAt(page, at, { x: 0, y: 10 }, { ctrlKey: true })
  await expect.poll(async () => (await boxOf(card(page, 1))).width).toBeLessThan(before * 0.8)
  sameAsSlides(await chromeOf(live(page)), slides, "mid zoom out")
  await resizeFromEdge(page, stack, deck, grown)
})
