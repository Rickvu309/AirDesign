import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { largeTextBox } from "../large-text.mjs"

const { connectionCopy } = createRequire(import.meta.url)(
  "../../../../../apps/web/src/copy/connection-copy.ts",
)

async function drive(kit) {
  const element = await largeTextBox(kit)
  await element.dblclick({ position: { x: 10, y: 10 }, force: true })
  const editing = element.locator('[contenteditable="true"]')
  await expect(editing).toBeFocused()
  await editing.press(connectionCopy.end)
  await editing.press("!")
  await editing.press("Escape")
  await kit.page.waitForTimeout(1500)
}

export default { name: "editor-large-text-typed", design: "/screens/s49-04-editor-errors-unreached", drive }
