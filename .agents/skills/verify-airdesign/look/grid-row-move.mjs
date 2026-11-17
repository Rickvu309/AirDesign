import { expect } from "@playwright/test"
import { openRowDeck } from "./grid-row-add.mjs"

export const handle = (page, row = 1) => page.getByRole("button", { name: `Move row ${row}`, exact: true })
export async function prepareRows(kit) {
  const account = await openRowDeck(kit, 7)
  const { page } = kit
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill("22")
  await page.keyboard.press("Enter")
  const source = await page.locator('[data-slide-entry="4"]').boundingBox()
  const target = await page.locator('[data-slide-entry="7"]').boundingBox()
  await page.mouse.move(source.x + source.width * 0.8, source.y + source.height * 0.8)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width * 0.9, target.y + target.height * 0.8, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('[data-grid-row="0"] [data-slide-entry]')).toHaveCount(3)
  return account
}
export async function rowMoveState(kit, state) {
  const account = await prepareRows(kit)
  const { page } = kit
  const one = await page.locator('[data-slide-entry="1"]').boundingBox()
  const two = await page.locator('[data-slide-entry="2"]').boundingBox()
  await page.mouse.move((one.x + one.width + two.x) / 2, one.y + one.height / 2)
  if ((await handle(page).count()) === 0) return account
  await expect(handle(page)).toHaveCSS("opacity", "1")
  if (state === "hover") return account
  await handle(page).focus()
  if (state === "keyboard") {
    await page.keyboard.press("Alt+ArrowDown")
    return account
  }
  const button = await handle(page).boundingBox()
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
  await page.mouse.down()
  const last = await page.locator('[data-slide-entry="7"]').boundingBox()
  await page.mouse.move(one.x + one.width, last.y + last.height + 24, { steps: 10 })
  await expect(page.locator("[data-drop-bar][data-row-drop]")).toBeVisible()
  if (state === "drag") return account
  await page.mouse.up()
  await expect(page.locator('[data-grid-row="0"] [data-slide-entry]')).toHaveCount(4)
  return account
}
