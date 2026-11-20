import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { snapReach } from "../../packages/render/src/snapping.ts"
import { busyDeck, busyKey, cardId } from "./busy-deck.ts"
import { dragFeel, type Feel } from "./drag-feel.ts"
import { decksOn } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 } })

const chosen = [cardId(1, 0), cardId(1, 1), cardId(1, 2), cardId(2, 0), cardId(2, 1), cardId(2, 2)]
const lead = cardId(1, 0)
const by = { x: 240, y: 90 }
const tenths = (value: number) => Math.round(value * 10) / 10

async function openBusy(page: Page): Promise<void> {
  await decksOn(page).open({
    name: "busy.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await busyDeck(),
  })
}

function frame(page: Page, shape: number) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${busyKey(shape)}"]`)
}

function thumbnail(page: Page, shape: number) {
  return page.locator(`[data-thumb-paint] [data-thumb-element="${busyKey(shape)}"]`).first()
}

const corner = (target: HTMLElement) => [Number.parseFloat(target.style.left), Number.parseFloat(target.style.top)]

async function corners(page: Page): Promise<number[][]> {
  return Promise.all(chosen.map((shape) => frame(page, shape).evaluate(corner)))
}

async function centre(page: Page, shape: number): Promise<{ x: number; y: number }> {
  const box = await frame(page, shape).boundingBox()
  if (box === null) throw new Error(`no card ${String(shape)}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function chooseCards(page: Page): Promise<void> {
  const first = await centre(page, lead)
  await page.mouse.click(first.x, first.y)
  await page.keyboard.down("Shift")
  for (const shape of chosen.filter((each) => each !== lead)) {
    const each = await centre(page, shape)
    await page.mouse.click(each.x, each.y)
  }
  await page.keyboard.up("Shift")
  await expect(page.locator("[data-selection-around]")).toHaveAttribute("data-selection-around", String(chosen.length))
}

async function thumbnailScale(page: Page): Promise<number> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const thumb = await page.locator("[data-thumb-paint]").first().boundingBox()
  if (slide === null || thumb === null) throw new Error("no slide or thumbnail")
  return thumb.width / slide.width
}

async function report(feel: Feel): Promise<void> {
  const limits = JSON.parse(await readFile(join(process.cwd(), "metrics.json"), "utf8")) as Record<
    string,
    { readonly limit?: number }
  >
  for (const [name, now] of [
    ["drag-frame", feel.frameP95],
    ["drag-delay", feel.delayP95],
  ] as const) {
    const limit = limits[name]?.limit
    if (limit === undefined) throw new Error(`${name} has no limit in metrics.json.`)
    const notes = test.info().annotations
    notes.push({ type: "metric", description: `metric ${name}  now ${String(now)}  limit ${String(limit)}` })
    if (now > limit)
      notes.push({
        type: "warning",
        description: `${name} is ${String(now)} and its limit is ${String(limit)}. Make it faster.`,
      })
  }
}

test("a drag of six cards on a busy slide paints and styles once a frame, leaves their text, the filmstrip and the Design panel until it lands, and undoes in one step", async ({
  page,
}) => {
  await openBusy(page)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await chooseCards(page)
  await expect(page.locator("[data-design-panel]").first()).toBeVisible()
  const before = await corners(page)
  const thumbBefore = await thumbnail(page, lead).evaluate(corner)
  const from = await centre(page, lead)
  const feel = await dragFeel(page, from, by, 120, busyKey(lead))
  await report(feel)
  expect(feel.placements, "the dragged card paints at most once a frame").toBeLessThanOrEqual(2 * feel.frames)
  expect(feel.layouts, "no layout read forces a second layout in a frame").toBeLessThanOrEqual(feel.frames + 2)
  expect(feel.styles, "no write between frames forces a second style pass").toBeLessThanOrEqual(feel.frames + 2)
  expect(feel.restyled, "the cards' text keeps its style while they move").toBe(0)
  expect(feel.thumbnails, "the filmstrip waits for the drag to land").toBe(0)
  expect(feel.panel, "the Design panel shows Mixed X and Y and waits for the drag to land").toBe(0)
  const landed = await corners(page)
  const shifts = landed.map(([x = 0, y = 0], index) => [x - (before[index]?.[0] ?? 0), y - (before[index]?.[1] ?? 0)])
  const [dx = 0, dy = 0] = shifts[0] ?? []
  expect(shifts.flat().map(tenths), "the six cards move together").toEqual(shifts.flatMap(() => [dx, dy]).map(tenths))
  expect(Math.abs(dx - by.x), "the cards land where the pointer left them, or snapped").toBeLessThanOrEqual(snapReach)
  expect(Math.abs(dy - by.y), "the cards land where the pointer left them, or snapped").toBeLessThanOrEqual(snapReach)
  const scale = await thumbnailScale(page)
  await expect
    .poll(async () => (await thumbnail(page, lead).evaluate(corner)).map(Math.round))
    .toEqual(thumbBefore.map((at, index) => Math.round(at + (index === 0 ? dx : dy) * scale)))
  await page.keyboard.press("Control+z")
  await expect.poll(async () => (await corners(page)).flat().map(Math.round)).toEqual(before.flat().map(Math.round))
})
