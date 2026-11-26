import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { clickSlide, openEditor } from "./editor-deck"
import { editor } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a cover title's box hugs its lines and grows upward as the title wraps, leaving the subtitle where it is", async ({
  page,
  context,
  stack,
}, testInfo) => {
  await openEditor(page, context, stack)
  await clickSlide(page, 600, 500)
  const outline = page.locator("[data-selection-outline]")
  const subtitle = page.locator("[data-slide-box] [data-node]").nth(1)
  await expect(outline).toHaveCount(1)
  const one = (await outline.boundingBox())!
  const below = (await subtitle.boundingBox())!
  const line = (await page.locator("[data-slide-box] [data-line]").first().boundingBox())!
  expect(Math.abs(one.height - line.height)).toBeLessThan(6)
  await page.screenshot({ path: testInfo.outputPath("one-line.png") })

  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Quarterly review for the board and every team that reports to it")
  await expect.poll(async () => page.locator("[data-text-editor] [data-line]").count()).toBe(2)
  await page.keyboard.press("Escape")
  await expect(editor(page)).toHaveCount(0)
  await expect.poll(async () => (await outline.boundingBox())!.height).toBeGreaterThan(one.height * 1.8)
  const two = (await outline.boundingBox())!
  expect(Math.abs(two.y + two.height - (one.y + one.height))).toBeLessThan(1)
  expect(two.y).toBeLessThan(one.y - one.height * 0.8)
  expect((await subtitle.boundingBox())!.y).toBe(below.y)
  await page.screenshot({ path: testInfo.outputPath("two-lines.png") })
})
