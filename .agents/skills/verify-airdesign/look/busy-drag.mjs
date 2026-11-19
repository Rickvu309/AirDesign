import { expect } from "@playwright/test"
import { busyDeck, busyKey, cardBox, cardId } from "../../../../tests/browser/busy-deck.ts"
import { snapReach } from "../../../../packages/render/src/snapping.ts"
import { openDeck } from "./open-deck.mjs"

const places = [
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
]

export const chosen = places.map(([row, column]) => cardId(row, column))

export const fileBoxes = places.map(([row, column]) => cardBox(row, column))
export const lead = cardId(1, 0)
export const dragBy = { x: 240, y: 90 }

export const card = (page, shape) => page.locator(`[data-slide-paint] [data-canvas-element="${busyKey(shape)}"]`)

export const thumbnailCard = (page, shape) =>
  page.locator(`[data-thumb-paint] [data-thumb-element="${busyKey(shape)}"]`).first()

export const corner = (target) => [Number.parseFloat(target.style.left), Number.parseFloat(target.style.top)]

export async function openBusyDeck(kit) {
  const { page } = kit
  await page.goto("/")
  await openDeck(page, {
    name: "busy.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await busyDeck(),
  })
  return page.url().split("/").at(-1)
}

export async function chooseCards(page) {
  const centre = async (shape) => {
    const box = await card(page, shape).boundingBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const first = await centre(lead)
  await page.mouse.click(first.x, first.y)
  await page.keyboard.down("Shift")
  for (const shape of chosen.filter((each) => each !== lead)) {
    const at = await centre(shape)
    await page.mouse.click(at.x, at.y)
  }
  await page.keyboard.up("Shift")
  await expect(page.locator("[data-selection-around]")).toHaveAttribute("data-selection-around", String(chosen.length))
}

export async function leadCentre(page) {
  const box = await card(page, lead).boundingBox()
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}

export async function holdDrag(page) {
  const [x = 0, y = 0] = await card(page, lead).evaluate(corner)
  const from = await leadCentre(page)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dragBy.x, from.y + dragBy.y, { steps: 12 })
  await expect
    .poll(async () => {
      const [left = 0, top = 0] = await card(page, lead).evaluate(corner)
      return Math.abs(left - x - dragBy.x) <= snapReach && Math.abs(top - y - dragBy.y) <= snapReach
    })
    .toBe(true)
}
