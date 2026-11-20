import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"

const deckFile = fileURLToPath(new URL("../../../../scripts/pptx-fixtures/connectors.pptx", import.meta.url))
const slide = "ppt/slides/slide1.xml"
const slideWidth = 12_192_000

async function opened({ page, signIn }) {
  const signed = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(deckFile)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const placement = (shape) =>
    element(shape).evaluate((frame) => [
      frame.style.left,
      frame.style.top,
      frame.style.width,
      frame.style.height,
      frame.style.transform,
    ])
  const point = async (x, y) => {
    const paint = await canvas.boundingBox()
    if (paint === null) throw new Error("no slide")
    const scale = paint.width / slideWidth
    return { x: paint.x + x * scale, y: paint.y + y * scale }
  }
  return { ...signed, deck, element, placement, point }
}

export async function following(kit) {
  const shown = await opened(kit)
  const { page } = kit
  await shown.element(3).click({ position: { x: 20, y: 20 } })
  const box = await shown.element(3).boundingBox()
  if (box === null) throw new Error("no element box")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 145, { steps: 8 })
  return shown
}

export async function around(kit) {
  const shown = await opened(kit)
  const { page } = kit
  await shown.element(3).click({ position: { x: 20, y: 20 } })
  const box = await shown.element(3).boundingBox()
  if (box === null) throw new Error("no element box")
  const from = await shown.point(6_477_000, 4_381_500)
  const to = await shown.point(1_828_800, 5_334_000)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + to.x - from.x, box.y + box.height / 2 + to.y - from.y, { steps: 8 })
  return shown
}

export async function freed(kit) {
  const shown = await opened(kit)
  const { page } = kit
  const bend = await shown.point(4_572_000, 3_619_500)
  await page.mouse.click(bend.x, bend.y)
  const grip = await page.locator('[data-connector-end="end"]').boundingBox()
  if (grip === null) throw new Error("no end grip")
  const free = await shown.point(9_000_000, 1_400_000)
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(free.x, free.y, { steps: 6 })
  await page.mouse.up()
  return { ...shown, free }
}

export default async function drive(kit) {
  const { page, capture, post, deckRoutes } = kit
  const shown = await following(kit)
  const file = { between: ["250px", "187.5px", "100px", "100px", ""] }
  await expect.poll(() => shown.placement(4)).not.toEqual(file.between)
  const dragging = [await shown.placement(4), await shown.placement(5)]
  expect(dragging[1][4]).toBe("rotate(90deg) scale(-1, -1)")
  await capture("connector-follow")
  await page.mouse.up()
  await expect.poll(() => shown.placement(5)).toEqual(dragging[1])
  const saved = async (opened) => (await post(deckRoutes.open, { deck: opened.deck }, opened.cookie)).json
  await expect.poll(async () => JSON.stringify((await saved(shown)).register.elements)).toContain('"property":"box"')
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => shown.placement(4)).toEqual(file.between)
  await capture("connector-follow-undone")

  const loose = await freed(kit)
  await expect(page.getByRole("button", { name: "Undo connector", exact: true })).toBeVisible()
  await expect
    .poll(async () => {
      const end = await page.locator('[data-connector-end="end"]').boundingBox()
      return end === null
        ? Infinity
        : Math.hypot(end.x + end.width / 2 - loose.free.x, end.y + end.height / 2 - loose.free.y)
    })
    .toBeLessThan(2)
  await expect.poll(async () => JSON.stringify((await saved(loose)).register.elements)).toContain('"none":true')
  await capture("connector-freed")
  await page.getByRole("button", { name: "Undo connector", exact: true }).click()
  await expect.poll(() => loose.placement(4)).toEqual(file.between)
  await capture("connector-freed-undone")
}
