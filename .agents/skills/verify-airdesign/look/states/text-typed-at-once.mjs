import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { placeText } from "../../bin/text-place.mjs"

async function drive({ page, context, signIn }) {
  await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(0)
  const device = await context.newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await placeText(page)
  await page.keyboard.type("Typed at once", { delay: 0 })
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toBeFocused()
  await device.send("Emulation.setCPUThrottlingRate", { rate: 1 })
  await expect(page.getByRole("button", { name: /^Undo (add text box|text edit)$/ })).toBeEnabled()
}

export default { name: "text-typed-at-once", design: editor, drive }
