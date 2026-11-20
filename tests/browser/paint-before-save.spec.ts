import { expect, type Locator } from "@playwright/test"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { forward, signInBrowser, test } from "./api-stack"
import { decksOn } from "./deck-test"
import { holdDeviceStore } from "./device-store"

function fontSize(words: Locator): Promise<number> {
  return words
    .locator("[data-paragraph] > span")
    .first()
    .evaluate((run) => parseFloat(getComputedStyle(run).fontSize))
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a font size set in the Design panel paints while the device is still storing earlier edits, and is kept", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decksOn(page).open()
  const words = page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await words.click()
  await words.press("End")
  await words.pressSequentially(" there")
  await words.press("Escape")
  const frame = page.locator("[data-slide-paint] [data-canvas-element]").first()
  const start = await frame.boundingBox()
  if (start === null) throw new Error("not painted")
  await page.mouse.move(start.x + 20, start.y + start.height - 10)
  await page.mouse.down()
  await page.mouse.move(start.x + 120, start.y + start.height + 30, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  const dropped = await frame.boundingBox()
  if (dropped === null) throw new Error("not painted")
  expect(dropped.x - start.x).toBeGreaterThan(50)
  const size = page.locator("[data-design-element]").getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })
  await expect(size).toBeVisible()
  const before = await fontSize(words)

  const release = await holdDeviceStore(page)
  await size.fill("60")
  await size.press("Enter")
  await expect.poll(() => fontSize(words), { timeout: 1000 }).toBeGreaterThan(before * 1.5)
  expect(Math.abs(((await frame.boundingBox())?.x ?? 0) - dropped.x)).toBeLessThan(1.5)
  await expect(words).toHaveText("Hello there")
  await expect(size).toHaveValue("60")
  await release()

  const grown = await fontSize(words)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.format, exact: true })).toBeEnabled()
  expect(await fontSize(words)).toBe(grown)
  await page.reload()
  expect(await decksOn(page).ready()).toBe(deck)
  await expect(words).toHaveText("Hello there")
  await expect.poll(() => fontSize(words)).toBe(grown)
})
