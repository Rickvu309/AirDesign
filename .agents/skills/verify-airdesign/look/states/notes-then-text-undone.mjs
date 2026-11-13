import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { notesState } from "../notes-deck.mjs"

async function drive(kit) {
  await notesState(kit, true)
  const held = []
  await kit.page.route(`**${kit.deckRoutes.commit.path}`, (route) => held.push(route))
  const field = kit.page.getByRole("textbox", { name: "Speaker notes", exact: true })
  await expect(field).toBeEditable()
  await field.pressSequentially("Hi", { delay: 40 })
  await expect.poll(() => held.length).toBeGreaterThan(0)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await text.click()
  await kit.page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await kit.page.keyboard.press("ControlOrMeta+z")
  await kit.page.waitForTimeout(1500)
}

export default { name: "notes-then-text-undone", design: editor, drive }
