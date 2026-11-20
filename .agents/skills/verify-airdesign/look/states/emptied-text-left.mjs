import { expect } from "@playwright/test"
import { importTitleDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("./")
  await importTitleDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const slide = page.locator("[data-slide-paint]").first()
  const texts = slide.locator('[contenteditable="true"]')
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  const placeholders = await texts.count()
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.82)
  await page.keyboard.type("Source: 2026 field survey", { delay: 0 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(placeholders + 1)
  await texts.last().dblclick()
  await expect(texts.last()).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect(texts.last()).toHaveText("")
  await page.keyboard.press("Escape")
  await page.waitForTimeout(500)
}

export default { name: "emptied-text-left", design: editor, drive }
