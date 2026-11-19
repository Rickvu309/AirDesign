import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { snapReach } from "../../packages/render/src/snapping.ts"
import { busyDeck, busyKey, cardId } from "./busy-deck.ts"
import { settled } from "./design-panel.ts"
import { dragFeel, type Feel } from "./drag-feel.ts"

test.use({ viewport: { width: 1470, height: 923 } })

const chosen = [cardId(1, 0), cardId(1, 1), cardId(1, 2), cardId(2, 0), cardId(2, 1), cardId(2, 2)]
const lead = cardId(1, 0)
const by = { x: 240, y: 90 }
const tenths = (value: number) => Math.round(value * 10) / 10

async function openBusy(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "busy.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await busyDeck(),
  })
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
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
  await page.keyboard.press("Escape")
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
  const lines: string[] = []
  for (const [name, now] of [
    ["drag-frame", feel.frameP95],
    ["drag-delay", feel.delayP95],
  ] as const) {
    const limit = limits[name]?.limit
    if (limit === undefined) throw new Error(`${name} has no limit in metrics.json.`)
    lines.push(`metric ${name}  now ${String(now)}  limit ${String(limit)}`)
    if (now > limit) {
      const over = `${name} is ${String(now)} and its limit is ${String(limit)}. Make it faster.`
      test.info().annotations.push({ type: "warning", description: over })
      lines.push(over)
    }
  }
  console.log([...lines, JSON.stringify(feel)].join("\n"))
  await mkdir("test-results", { recursive: true })
  await writeFile("test-results/drag-feel.json", `${JSON.stringify(feel)}\n`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary !== undefined) await appendFile(summary, `\n${lines.join("\n")}\n`)
}

test("a drag of six cards on a busy slide paints once a frame, leaves the filmstrip and Design panel until it lands, and undoes in one step", async ({
  page,
}) => {
  await openBusy(page)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await chooseCards(page)
  await expect(page.locator("[data-design-panel]").first()).toBeVisible()
  const before = await corners(page)
  const thumbBefore = await thumbnail(page, lead).evaluate(corner)
  const band = await page.locator("[data-selection-around] [data-grip=move]").first().boundingBox()
  if (band === null) throw new Error("no move band")
  const from = { x: band.x + band.width / 3, y: band.y + band.height / 2 }
  const feel = await dragFeel(page, from, by, 120, busyKey(lead))
  await report(feel)
  expect(feel.placements, "the dragged card paints at most once a frame").toBeLessThanOrEqual(2 * feel.frames)
  expect(feel.layouts, "no layout read forces a second layout in a frame").toBeLessThanOrEqual(feel.frames + 2)
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
