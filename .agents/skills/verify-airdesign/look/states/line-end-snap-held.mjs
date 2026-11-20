import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const slideWidth = 12_192_000
const emuPerPixel = 15_240

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("./")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  const paint = await page.locator("[data-slide-paint]").boundingBox()
  if (paint === null) throw new Error("no slide")
  const scale = (paint.width / slideWidth) * emuPerPixel
  const point = (x, y) => ({ x: paint.x + x * scale, y: paint.y + y * scale })
  const middle = point(420, 300)
  await page.mouse.click(middle.x, middle.y)
  await expect(page.locator('[data-connector-end="end"]')).toBeVisible()
  const end = point(540, 300)
  const near = point(452, 303)
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.move(near.x, near.y, { steps: 8 })
  await expect(page.locator("[data-connector-aim]")).toBeVisible()
}

export default { name: "line-end-snap-held", design: editor, drive }
