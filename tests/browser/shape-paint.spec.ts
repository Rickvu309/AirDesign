import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { PNG } from "pngjs"
import { shapeDeck } from "./shape-deck"
import { exportFromDialog } from "./export-dialog.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a preset arrow selects, moves and resizes by its box, and a connector drags by its stroke", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "movable-shapes.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await shapeDeck(),
  })
  const arrow = page.locator('[data-canvas-element="ppt/slides/slide1.xml#2"]')
  await expect(arrow.locator('[contenteditable="true"]')).toHaveText("Hello")
  const before = await arrow.boundingBox()
  if (before === null) throw new Error("no arrow")
  await arrow.locator('[contenteditable="true"]').click()
  const selection = page.locator("[data-selection]")
  await expect(selection).toBeVisible()
  const frame = await selection.boundingBox()
  expect(frame).toEqual(before)
  await page.mouse.move(before.x + before.width / 2, before.y + before.height)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 30, before.y + before.height + 20, { steps: 8 })
  await page.mouse.up()
  const moved = await arrow.boundingBox()
  expect(moved).toEqual({ ...before, x: before.x + 30, y: before.y + 20 })
  expect(await selection.boundingBox()).toEqual(moved)
  await page.mouse.move(before.x + before.width + 30, before.y + before.height + 20)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width + 90, before.y + before.height + 40, { steps: 8 })
  await page.mouse.up()
  expect(await arrow.boundingBox()).toEqual({
    x: before.x + 30,
    y: before.y + 20,
    width: before.width + 60,
    height: before.height + 20,
  })
  const thumb = page.locator("[data-thumb-paint] [data-canvas-path]").first()
  await expect(thumb).toBeVisible()
  expect(await thumb.locator("g > path").first().getAttribute("d")).toMatch(/^M0 /)
  const connector = page.locator('[data-canvas-element="ppt/slides/slide1.xml#3"]')
  const start = await connector.boundingBox()
  if (start === null) throw new Error("no connector")
  await page.mouse.move(start.x + 20, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 40, start.y + 20, { steps: 8 })
  await page.mouse.up()
  expect(await connector.boundingBox()).toEqual({ ...start, x: start.x + 20, y: start.y + 20 })
})

test("a custom triangle paints its path instead of a rectangle", async ({ page }) => {
  test.fail()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "custom-shape.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await shapeDeck(true),
  })
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
  const triangle = page.locator('[data-canvas-element="ppt/slides/slide1.xml#2"]')
  expect(await triangle.locator("[data-canvas-path]").count()).toBe(1)
})

test("an imported arrow and callout keep their outlines, connector ends paint, and export is untouched", async ({
  page,
}) => {
  const original = await shapeDeck()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "shapes.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: original,
  })
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
  const arrow = page.locator('[data-canvas-element="ppt/slides/slide1.xml#2"]')
  await expect(arrow.locator("[data-canvas-path]")).toBeVisible()
  await expect(arrow.locator("rect")).toHaveCount(0)
  await expect(arrow.locator('[contenteditable="true"]')).toHaveText("Hello")
  const image = PNG.sync.read(await arrow.screenshot())
  const pixel = (x: number, y: number) =>
    [...image.data.subarray((Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * 4)].slice(0, 3)
  expect(pixel(0.02, 0.05)).toEqual([255, 255, 255])
  expect(pixel(0.5, 0.6)).toEqual([255, 0, 0])
  const connector = page.locator('[data-canvas-element="ppt/slides/slide1.xml#3"]')
  await expect(connector.locator("line")).toHaveAttribute("marker-start", /url\(#.+-head\)/)
  await expect(connector.locator("line")).toHaveAttribute("marker-end", /url\(#.+-tail\)/)
  await expect(connector.locator("line")).toHaveAttribute("stroke-dasharray", /\d/)
  const end = await connector.boundingBox()
  if (end === null) throw new Error("no connector")
  const head = PNG.sync.read(
    await page.screenshot({ clip: { x: end.x + end.width - 12, y: end.y - 12, width: 24, height: 24 } }),
  )
  let offLine = 0
  for (let y = 0; y < 24; y += 1) {
    if (Math.abs(y - 12) < 3) continue
    for (let x = 0; x < 24; x += 1) {
      const at = (y * 24 + x) * 4
      if (head.data[at]! < 80 && head.data[at + 1]! < 80 && head.data[at + 2]! < 80) offLine += 1
    }
  }
  expect(offLine).toBeGreaterThan(0)
  const callout = page.locator('[data-canvas-element="ppt/slides/slide1.xml#6"]')
  const box = await callout.boundingBox()
  if (box === null) throw new Error("no callout")
  const tail = PNG.sync.read(
    await page.screenshot({ clip: { x: box.x, y: box.y + box.height, width: box.width, height: box.height / 5 } }),
  )
  expect([...tail.data].filter((channel, index) => index % 4 === 1 && channel < 80).length).toBeGreaterThan(0)
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = await (await download).path()
  if (file === null) throw new Error("no export")
  expect(await readFile(file)).toEqual(original)
})
