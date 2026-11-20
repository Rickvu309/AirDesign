import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"
import { undoCopy } from "../bin/product-copy.mjs"
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
