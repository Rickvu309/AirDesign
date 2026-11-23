import { notesCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { selectNode } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { notesState } from "../doom-notes-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await notesState(kit, true)
  const held = []
  await page.route(`**${kit.doomRoutes.edit.path}`, (route) => held.push(route))
  const field = page.getByRole("textbox", { name: notesCopy.value, exact: true })
  await expect(field).toBeEditable()
  await field.click()
  await page.keyboard.press("ControlOrMeta+End")
  await field.pressSequentially(" Hi", { delay: 40 })
  await expect.poll(() => held.length).toBeGreaterThan(0)
  await selectNode(page, "s:4")
  await page.keyboard.press("Enter")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Mine", { delay: 40 })
  await page.keyboard.press("ControlOrMeta+z")
  await page.waitForTimeout(1500)
}

export default { name: "notes-then-text-undone", design: editor, drive }
