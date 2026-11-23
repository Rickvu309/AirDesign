import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { savedNode } from "../doom-deck.mjs"
import { moveThree } from "./three-moved.mjs"

async function drive(kit) {
  const opened = await moveThree(kit)
  await kit.page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await savedNode(kit, opened, "w:2")).box.y).toBe(740)
  await expect(kit.page.locator("[data-selection-outline]")).toHaveCount(3)
}

export default { name: "three-undone", design: editor, drive }
