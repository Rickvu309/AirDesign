import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const slide = page.locator("[data-slide-paint]").first()
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.15)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 0 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await page.keyboard.press("t")
  await page.mouse.move(box.x + box.width * 0.1 + 3, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 4 })
  await page.mouse.move(box.x + box.width / 2 - 3, box.y + box.height * 0.6, { steps: 4 })
}

export default { name: "text-drag-snap-held", design: editor, drive }
