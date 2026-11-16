import { expect } from "@playwright/test"
import { largeTextBox } from "../large-text.mjs"

async function drive(kit) {
  const element = await largeTextBox(kit)
  await element.dblclick({ position: { x: 10, y: 10 }, force: true })
  const editing = element.locator('[contenteditable="true"]')
  await expect(editing).toBeFocused()
  await editing.press("End")
  await editing.press("!")
  await editing.press("Escape")
  await kit.page.waitForTimeout(1500)
}

export default { name: "editor-large-text-typed", design: "/screens/s49-04-editor-errors-unreached", drive }
