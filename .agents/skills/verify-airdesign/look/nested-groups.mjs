import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"
import { transitionCopy, undoCopy } from "../bin/product-copy.mjs"
import { openDeck } from "./open-deck.mjs"

const fixture = fileURLToPath(new URL("../../../../scripts/pptx-fixtures/nested-groups.pptx", import.meta.url))
const leaf = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

export async function leafPicked(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, fixture)
  await kit.page.locator(leaf).click({ modifiers: ["Control"] })
}

export async function leafMoved(kit) {
  await leafPicked(kit)
  const box = await kit.page.locator(leaf).boundingBox()
  if (box === null) throw new Error("no leaf")
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await kit.page.mouse.move(x, y)
  await kit.page.mouse.down()
  await kit.page.mouse.move(x + 120, y + 40, { steps: 8 })
  await kit.page.mouse.up()
  const undo = kit.page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })
  await expect(undo)
    .toBeEnabled({ timeout: 3000 })
    .catch(() => undefined)
}

const row = (page, shape) => page.locator(`[data-layers-panel] [data-layer-row$=".${String(shape)}"]`)

async function layersOpened(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, fixture)
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator("[data-design-mode]").click()
  for (const shape of [2, 3]) {
    const opened = row(kit.page, shape)
    if ((await opened.getAttribute("aria-expanded")) === "false") await opened.locator("[data-layer-caret]").click()
  }
}

async function rowHeld(page, from, to, share) {
  const start = await row(page, from).boundingBox()
  const end = await row(page, to).boundingBox()
  if (start === null || end === null) throw new Error("no layer row")
  await page.mouse.move(start.x + 60, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + 60, end.y + end.height * share, { steps: 8 })
  await page.mouse.move(end.x + 61, end.y + end.height * share)
}

export async function looseHeldOverTurned(kit) {
  await layersOpened(kit)
  await rowHeld(kit.page, 7, 3, 0.5)
  await kit.page
    .locator('[data-layers-panel] [data-layer-drop="inside"]')
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
}

export async function turnedEmptied(kit) {
  await layersOpened(kit)
  for (const [from, to] of [
    [4, 7],
    [5, 4],
  ]) {
    await rowHeld(kit.page, from, to, 0.9)
    await kit.page.mouse.up()
    await expect(row(kit.page, from))
      .toHaveAttribute("aria-level", "1", { timeout: 3000 })
      .catch(() => undefined)
  }
}
