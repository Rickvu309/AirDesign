import { expect } from "@playwright/test"
import { createRequire } from "node:module"
import { selectSlides } from "./grid-selection.mjs"

const { slideListCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/slide-list-copy.ts")

export async function editSlideSet(kit, change) {
  const { page } = kit
  await selectSlides(kit)
  const third = page.locator('[data-slide-entry="3"]')
  await third.press("ContextMenu")
  await expect(page.getByRole("menu")).toBeVisible()
  const action = page.getByRole("menuitem", { name: new RegExp(slideListCopy.setActions(3)[change]) })
  const available = (await action.count()) === 1 && (await action.isEnabled())
  await page.keyboard.press("Escape")
  await page.keyboard.press(change === "remove" ? slideListCopy.deleteKey : "ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(available ? (change === "remove" ? 4 : 10) : 7)
}
