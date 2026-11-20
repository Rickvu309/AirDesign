import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const slide = page.locator("[data-slide-paint]").first()
  const layers = slide.locator("[data-canvas-element]")
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("r")
  await page.keyboard.press("Enter")
  await expect(layers).toHaveCount(1)
  await page.keyboard.press("Enter")
  await page.keyboard.type("Sales up", { delay: 0 })
}

export default { name: "shape-typed", design: editor, drive }
