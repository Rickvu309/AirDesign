import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { landNodes, openEditor, savedNode, selectedIds, slidePoint, spot, type Opened } from "./editor-deck"
import type { Stack } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })
test.describe.configure({ mode: "parallel" })

type Box = ReturnType<typeof spot>
type Run = { readonly mask: object; readonly box: Box; readonly content: Box }
type Rgb = readonly [number, number, number]

const tones = ["accent1", "accent2"] as const
const slideWide = spot(0, 0, 1920, 1080)
const emptyCorner = { x: 1890, y: 1050 }
let clears = 0

const scenes: Readonly<Record<string, readonly Run[]>> = {
  "a rounded mask": [{ box: spot(600, 300, 600, 400), mask: { radius: 150 }, content: spot(560, 260, 680, 480) }],
  "a per-corner mask": [
    { box: spot(600, 300, 600, 400), mask: { radius: [180, 0, 60, 0] }, content: spot(560, 260, 680, 480) },
  ],
  "an ellipse mask": [
    { box: spot(600, 300, 600, 400), mask: { geometry: { kind: "ellipse" } }, content: spot(560, 260, 680, 480) },
  ],
  "a path mask": [
    {
      box: spot(600, 300, 600, 400),
      mask: { geometry: { kind: "path", d: "M0 1L0.5 0L1 1Z" } },
      content: spot(560, 260, 680, 480),
    },
  ],
  "a flipped mask": [
    {
      box: { ...spot(600, 300, 600, 400), flipH: true },
      mask: { radius: [180, 0, 60, 0] },
      content: spot(560, 260, 680, 480),
    },
  ],
  "a turned and flipped mask": [
    {
      box: { ...spot(600, 300, 600, 400), rotation: 25, flipV: true },
      mask: { radius: [180, 0, 0, 0] },
      content: spot(450, 150, 900, 700),
    },
  ],
  "two masks": [
    { box: spot(300, 250, 600, 450), mask: { radius: 120 }, content: spot(260, 210, 680, 530) },
    { box: spot(700, 400, 600, 450), mask: { geometry: { kind: "ellipse" } }, content: spot(700, 400, 300, 450) },
  ],
}

const fills = (tone: string) => [{ kind: "solid", color: { var: tone } }]

async function clearSlide(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no fold")
  const writes = doom
    .childrenOf(fold, doom.nodeId(opened.slide))
    .map((node) => ({ node: node.id, prop: "parent", value: null }))
  if (writes.length === 0) return
  const edit = { once: `clear-${String((clears += 1))}`, author: { kind: "person", id: "other-tab" }, writes }
  const landed = await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
}

function layersOf(runs: readonly Run[], prefix: string, probe: boolean) {
  return runs.map((run, index) => ({
    mask: `${prefix}:${String(index * 2 + 1)}`,
    content: `${prefix}:${String(index * 2 + 2)}`,
    tone: tones[index]!,
    run,
    probe,
  }))
}

async function paint(stack: Stack, opened: Opened, page: Page, layers: ReturnType<typeof layersOf>) {
  await clearSlide(stack, opened)
  await landNodes(
    stack,
    opened,
    layers.flatMap((layer) => [
      {
        id: layer.mask,
        type: "shape" as const,
        parent: opened.slide,
        props: { box: layer.run.box, fills: fills("accent6"), mask: true, ...layer.run.mask },
      },
      {
        id: layer.content,
        type: "shape" as const,
        parent: opened.slide,
        props: { box: layer.probe ? slideWide : layer.run.content, fills: fills(layer.tone) },
      },
    ]),
  )
  await expect.poll(async () => (await savedNode(stack, opened, layers[0]!.mask))?.mask).toBe(true)
  const painted = page.locator("[data-slide-box] [data-node]")
  await expect(painted).toHaveCount(layers.length)
  for (const layer of layers)
    await expect(page.locator(`[data-slide-box] [data-node="${layer.content}"]`)).toHaveCount(1)
  await expect(page.locator("[data-slide-box] mask")).toHaveCount(layers.length)
}

async function toneOf(page: Page, id: string): Promise<Rgb> {
  return page.locator(`[data-slide-box] [data-node="${id}"] [data-body]`).evaluate((body) => {
    const solid = [body, ...body.querySelectorAll("*")]
      .map((element) => getComputedStyle(element).backgroundColor)
      .find((colour) => colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent")
    const parts = solid?.match(/\d+/g)?.map(Number) ?? []
    return [parts[0] ?? -1, parts[1] ?? -1, parts[2] ?? -1] as const
  })
}

async function pixels(page: Page, spots: readonly { readonly x: number; readonly y: number }[]) {
  const shot = await page.screenshot()
  return page.evaluate(
    async ({ base64, spots }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")
      if (context === null) throw new Error("no canvas")
      context.drawImage(bitmap, 0, 0)
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data
      const at = (x: number, y: number) => {
        const index = (y * bitmap.width + x) * 4
        return [data[index]!, data[index + 1]!, data[index + 2]!] as const
      }
      return spots.map(({ x, y }) => {
        const centre = at(x, y)
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const near = at(x + dx, y + dy)
            if (near.some((channel, index) => Math.abs(channel - centre[index]!) > 2)) return null
          }
        return centre
      })
    },
    { base64: shot.toString("base64"), spots },
  )
}

const same = (left: Rgb | null, right: Rgb) =>
  left !== null && left.every((channel, index) => Math.abs(channel - right[index]!) <= 2)

for (const [name, runs] of Object.entries(scenes))
  test(`a click on ${name} selects exactly the layer painted under the pointer`, async ({ page, context, stack }) => {
    covers("select")
    const opened = await openEditor(page, context, stack)
    const area = runs.flatMap((run) => [run.box, run.content])
    const left = Math.max(0, Math.min(...area.map((box) => box.x)) - 40)
    const top = Math.max(0, Math.min(...area.map((box) => box.y)) - 40)
    const right = Math.min(1880, Math.max(...area.map((box) => box.x + box.w)) + 40)
    const bottom = Math.min(1040, Math.max(...area.map((box) => box.y + box.h)) + 40)
    const grid: { readonly x: number; readonly y: number }[] = []
    for (let row = 0; row <= 14; row += 1)
      for (let column = 0; column <= 19; column += 1)
        grid.push({ x: left + ((right - left) * column) / 19, y: top + ((bottom - top) * row) / 14 })
    const screen = await Promise.all(grid.map(async (point) => slidePoint(page, point.x, point.y)))
    const spots = screen.map((point) => ({ x: Math.floor(point.x), y: Math.floor(point.y) }))

    const probes = layersOf(runs, "p", true)
    await paint(stack, opened, page, probes)
    const tonesOf = await Promise.all(probes.map(async (probe) => toneOf(page, probe.content)))
    const outlines = await pixels(page, spots)

    const layers = layersOf(runs, "t", false)
    await paint(stack, opened, page, layers)
    const painted = await pixels(page, spots)

    const topFirst = layers
      .flatMap((layer, index) => [
        { id: layer.mask, reads: outlines, tone: tonesOf[index]! },
        { id: layer.content, reads: painted, tone: tonesOf[index]! },
      ])
      .reverse()
    const clear = await slidePoint(page, emptyCorner.x, emptyCorner.y)
    const wrong: string[] = []
    let got: readonly string[] = []
    const seen = new Map<string, number>()
    for (const [index, spot] of spots.entries()) {
      if (outlines[index] === null || painted[index] === null) continue
      const holder = topFirst.find((layer) => same(layer.reads[index]!, layer.tone))
      const expected = holder === undefined ? [] : [holder.id]
      seen.set(holder?.id ?? "nothing", (seen.get(holder?.id ?? "nothing") ?? 0) + 1)
      if (got.length > 0) {
        await page.mouse.click(clear.x, clear.y)
        await expect.poll(() => selectedIds(page)).toEqual([])
      }
      await page.mouse.click(spot.x + 0.5, spot.y + 0.5)
      got = await selectedIds(page)
      if (JSON.stringify(got) !== JSON.stringify(expected))
        wrong.push(
          `(${grid[index]!.x.toFixed(0)}, ${grid[index]!.y.toFixed(0)}) painted ${JSON.stringify(expected)}, selected ${JSON.stringify(got)}`,
        )
    }
    expect(wrong).toEqual([])
    expect(seen.get("nothing") ?? 0).toBeGreaterThan(20)
    for (const layer of layers) expect(seen.get(layer.content) ?? 0).toBeGreaterThan(20)
    if (runs.length > 1) expect(seen.get(layers[1]!.mask) ?? 0).toBeGreaterThan(10)
  })
