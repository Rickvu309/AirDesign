import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  await expect(page.locator('[data-slide-entry="2"]')).toBeFocused()
  await page.keyboard.press("t")
  const slide = page.locator("[data-slide-paint]").first()
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  await page.mouse.click(box.x + box.width * 0.06, box.y + box.height * 0.1)
  await page.keyboard.type("Three levers close the gap", { delay: 0 })
}

export default { name: "slide-added-title", design: editor, drive }
