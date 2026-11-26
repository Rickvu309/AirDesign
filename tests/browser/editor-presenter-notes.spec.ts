import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { openEditor, savedNode } from "./editor-deck"

test("presenter notes wrap long text on desktop and phone", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const text = `Read https://example.com/${"quarterlyreview".repeat(18)}\nThen pause.`
  await page.locator("[data-notes-bar] textarea").fill(text)
  await expect.poll(async () => (await savedNode(stack, opened, opened.slide))?.notes).toMatchObject({ chars: text })
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })

  for (const viewport of [
    { width: 1470, height: 923 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.keyboard.press("Shift+F5")
    await expect(page.locator("[data-present-show] [data-present-slide]")).toHaveAttribute("data-present-slide", "1")
    await page.keyboard.press("p")
    const pane = page.locator("[data-present-notes] > div")
    await expect(pane).toBeVisible()
    await expect(page.locator('[data-present-current] [data-present-slide="1"]')).toBeVisible()
    const measured = await pane.evaluate((element) => ({
      notes: element.textContent,
      overflow: element.scrollWidth - element.clientWidth,
    }))
    expect(measured).toEqual({ notes: text, overflow: 0 })
    await page.keyboard.press("Escape")
    await expect(pane).toHaveCount(0)
    await page.waitForFunction(() => document.fullscreenElement === null)
  }
})
