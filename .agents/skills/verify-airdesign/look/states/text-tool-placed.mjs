import { expect } from "@playwright/test"
import { undoCopy } from "../../bin/product-copy.mjs"
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
  const texts = slide.locator('[contenteditable="true"]')
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.15)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 0 })
  await expect(texts).toHaveCount(1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await page.keyboard.press("t")
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 4 })
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6, { steps: 4 })
  await page.mouse.up()
  await expect(texts).toHaveCount(2)
  await page.keyboard.type("A box drawn with the Text tool keeps its width and wraps the words inside it", {
    delay: 0,
  })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.text })).toBeEnabled()
}

export default { name: "text-tool-placed", design: editor, drive }
