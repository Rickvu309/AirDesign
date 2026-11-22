import { expect } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openDoomEditor } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const percentOf = (text: string | null) => Number.parseInt(text ?? "", 10)

test("zoom keys, the wheel and the hand tool move around the slide as Figma does", async ({ page, context, stack }) => {
  covers("zoom-fit", "zoom-actual", "zoom-in", "zoom-out", "zoom-selection", "tool-hand", "tool-move", "pan")
  await openDoomEditor(page, context, stack)
  const percent = page.locator("[data-zoom-readout]")
  const fitted = percentOf(await percent.textContent())
  expect(fitted).toBeGreaterThan(40)
  expect(fitted).toBeLessThan(100)

  await page.keyboard.press("Shift+Digit0")
  await expect(percent).toHaveText(doomEditorCopy.percent(100))
  await page.keyboard.press("Shift+Equal")
  await expect(percent).toHaveText(doomEditorCopy.percent(150))
  await page.keyboard.press("Minus")
  await expect(percent).toHaveText(doomEditorCopy.percent(100))
  await page.keyboard.press("Shift+Digit1")
  await expect(percent).toHaveText(doomEditorCopy.percent(fitted))

  await clickSlide(page, 600, 410)
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => percentOf(await percent.textContent())).toBeGreaterThan(fitted)

  await page.keyboard.press("Shift+Digit0")
  const stage = page.locator("[data-doom-stage]")
  await expect.poll(() => stage.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  const left = await stage.evaluate((element) => element.scrollLeft)
  await page.getByRole("button", { name: doomEditorCopy.moveTools }).click()
  await page.getByRole("menuitem", { name: new RegExp(doomEditorCopy.toolHand) }).click()
  const room = await stage.boundingBox()
  await page.mouse.move((room?.x ?? 0) + 600, (room?.y ?? 0) + 300)
  await page.mouse.down()
  await page.mouse.move((room?.x ?? 0) + 500, (room?.y ?? 0) + 300, { steps: 4 })
  await page.mouse.up()
  expect(await stage.evaluate((element) => element.scrollLeft)).toBeGreaterThan(left)
  await page.keyboard.press("v")
  await expect(page.getByRole("button", { name: doomEditorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  await page.keyboard.press("Shift+Digit1")
  await page.keyboard.down("ControlOrMeta")
  await page.mouse.move((room?.x ?? 0) + 800, (room?.y ?? 0) + 450)
  await page.mouse.wheel(0, -200)
  await page.keyboard.up("ControlOrMeta")
  await expect.poll(async () => percentOf(await percent.textContent())).toBeGreaterThan(fitted)
})
