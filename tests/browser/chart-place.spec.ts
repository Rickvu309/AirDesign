import { expect } from "@playwright/test"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck } from "./design-panel"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 } })

test("a second chart from the toolbar lands beside a chart that was moved to the left, not over it", async ({
  page,
}) => {
  await openDeck(page, "blank.pptx")
  const slide = page.locator("[data-slide-paint]")
  const corner = await slide.boundingBox()
  if (corner === null) throw new Error("no slide")
  await page.mouse.click(corner.x + 8, corner.y + 8)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect(slide.locator("[data-canvas-element]")).toHaveCount(0)
  const frames = slide.locator("[data-canvas-element]").filter({ has: page.locator("svg[data-chart]") })
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await expect(frames).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("button", { name: shortcutCopy.gestures["design-mode"], exact: true }).click()
  await page.getByRole("button", { name: boxCopy.section, exact: true }).click()
  const x = page.getByRole("textbox", { name: /^X/ }).first()
  await x.fill("36")
  await x.press("Enter")
  await expect.poll(async () => Math.round((await frames.first().boundingBox())?.x ?? 0)).toBeLessThan(corner.x + 60)
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.line, exact: true }).click()
  await expect(frames).toHaveCount(2)
  const [left, right] = [await frames.nth(0).boundingBox(), await frames.nth(1).boundingBox()]
  if (left === null || right === null) throw new Error("no chart")
  expect(left.x + left.width <= right.x || right.x + right.width <= left.x).toBe(true)
})
