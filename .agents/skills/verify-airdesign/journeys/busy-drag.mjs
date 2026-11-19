import { transitionCopy, undoCopy } from "../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { snapReach } from "../../../../packages/render/src/snapping.ts"
import {
  card,
  chooseCards,
  chosen,
  corner,
  dragBy,
  fileBoxes,
  holdDrag,
  lead,
  openBusyDeck,
  thumbnailCard,
} from "../look/busy-drag.mjs"

function lastBox(register, node) {
  const rows = register?.elements?.[node]?.landed ?? []
  return rows.filter((row) => row.visible && row.property === "box").at(-1)?.value ?? null
}

const rounded = (pairs) => pairs.flat().map(Math.round)

const tenths = (value) => Math.round(value * 10) / 10

export default async function drive(kit) {
  const { page, signIn, post, capture, note, deckRoutes } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  const deck = await openBusyDeck(kit)
  note(`imported a four-slide busy deck as ${deck}: a fitted title, twenty cards with fitted text and a connector`)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await chooseCards(page)
  await capture("six-selected")
  note("selected six cards with a click and Shift+clicks, with the Design panel open")
  const corners = () => Promise.all(chosen.map((shape) => card(page, shape).evaluate(corner)))
  const before = await corners()
  const thumbBefore = await thumbnailCard(page, lead).evaluate(corner)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const thumb = await page.locator("[data-thumb-paint]").first().boundingBox()
  await holdDrag(page)
  expect(await thumbnailCard(page, lead).evaluate(corner)).toEqual(thumbBefore)
  await capture("drag-held")
  note(`mid-drag by ${dragBy.x},${dragBy.y} px: the six cards follow the pointer, the filmstrip keeps them at rest`)
  await page.mouse.up()
  const landed = await corners()
  const [dx, dy] = [landed[0][0] - before[0][0], landed[0][1] - before[0][1]]
  expect(landed.map(([x, y], index) => [x - before[index][0], y - before[index][1]].map(tenths))).toEqual(
    landed.map(() => [dx, dy].map(tenths)),
  )
  expect(Math.abs(dx - dragBy.x)).toBeLessThanOrEqual(snapReach)
  expect(Math.abs(dy - dragBy.y)).toBeLessThanOrEqual(snapReach)
  const scale = thumb.width / slide.width
  await expect
    .poll(async () => (await thumbnailCard(page, lead).evaluate(corner)).map(Math.round))
    .toEqual([Math.round(thumbBefore[0] + dx * scale), Math.round(thumbBefore[1] + dy * scale)])
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  await capture("drag-landed")
  note(
    `on release the cards land ${tenths(dx)},${tenths(dy)} px on, snapped within ${snapReach} px, and the filmstrip shows them there`,
  )
  const width = await card(page, lead).evaluate((target) => Number.parseFloat(target.style.width))
  const emu = (fileBoxes[0]?.cx ?? 0) / width
  const nodes = chosen.map((shape) => `256.${String(shape)}`)
  const serverBoxes = async () => {
    const register = (await post(deckRoutes.open, { deck }, cookie)).json.register
    return nodes.map((node) => lastBox(register, node))
  }
  const near = (boxes, by) =>
    boxes.every((box, index) => {
      const file = fileBoxes[index]
      return (
        box !== null &&
        Math.abs(box.x - (file.x + by.x * emu)) < emu &&
        Math.abs(box.y - (file.y + by.y * emu)) < emu &&
        box.cx === file.cx &&
        box.cy === file.cy
      )
    })
  await expect.poll(async () => near(await serverBoxes(), { x: dx, y: dy }), { timeout: 20_000 }).toBe(true)
  note(`server copy keeps the moved box of all six cards (${deckRoutes.open.path})`)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => rounded(await corners())).toEqual(rounded(before))
  await expect
    .poll(async () => (await thumbnailCard(page, lead).evaluate(corner)).map(Math.round))
    .toEqual(thumbBefore.map(Math.round))
  await capture("undone")
  note("one Ctrl+Z put all six cards back, on the slide and in the filmstrip")
  await expect.poll(async () => near(await serverBoxes(), { x: 0, y: 0 }), { timeout: 20_000 }).toBe(true)
  note("server copy has all six cards back at their first place after the one undo")
}
