import { expect } from "@playwright/test"
import { importTitleDeck } from "../bin/new-deck.mjs"
import { undoCopy } from "../bin/product-copy.mjs"

async function emptyAndLeave(page, words) {
  await words.dblclick()
  await expect(words).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect(words).toHaveText("")
}

export default async function drive({ page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await importTitleDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const slide = page.locator("[data-slide-paint]").first()
  const texts = slide.locator('[contenteditable="true"]')
  const order = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order.map((row) => row.slide)
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  const placeholders = await texts.count()
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.82)
  await page.keyboard.type("Source: 2026 field survey", { delay: 10 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(placeholders + 1)
  await expect.poll(order).toEqual(["element-add"])

  await emptyAndLeave(page, texts.last())
  await capture("text-emptied-editing")
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(placeholders)
  await expect.poll(order).toEqual(["element-add", "element-remove"])
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["delete-element"] })).toBeEnabled()
  await capture("emptied-text-removed")
  note(
    "a saved text whose words were all deleted was removed on Escape; the server holds element-add then element-remove",
  )

  await page.keyboard.press("ControlOrMeta+z")
  await expect(texts).toHaveCount(placeholders + 1)
  await expect(texts.last()).toHaveText("Source: 2026 field survey")
  await expect.poll(order).toEqual(["element-add", "element-remove", "element-restore"])
  await capture("emptied-text-undone")
  note("one Ctrl+Z brought the layer back with its words")

  await texts.first().dblclick()
  await expect(texts.first()).toBeFocused()
  await page.keyboard.type("Field survey results", { delay: 10 })
  await page.keyboard.press("Escape")
  await expect(texts.first()).toHaveText("Field survey results")
  await emptyAndLeave(page, texts.first())
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(placeholders + 1)
  await expect(texts.first()).toHaveText("")
  await capture("emptied-placeholder-kept")
  note("an emptied title placeholder stays, showing its prompt, as PowerPoint keeps it")
}
