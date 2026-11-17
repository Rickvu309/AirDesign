import { expect, test } from "@playwright/test"
import { designing, openDeck, pendingValues, settled } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

test("typing on the canvas rewrites the element's words in their own size and colour, and Undo brings the words back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  await expect(panel.getByRole("textbox", { name: "Text", exact: true })).toHaveCount(0)
  const words = editor
  await expect(words).toHaveText("Hello")
  await words.click()
  await words.press("ControlOrMeta+a")
  await page.keyboard.insertText("Hello there")
  await words.press("Enter")
  await page.keyboard.insertText("Second line")
  await words.blur()
  await expect(editor).toHaveText("Hello thereSecond line")
  await expect(editor.locator("[data-paragraph]")).toHaveCount(2)
  const sizes = () =>
    editor.locator("[data-run]").evaluateAll((runs) => runs.map((run) => getComputedStyle(run).fontSize))
  const [size] = await sizes()
  await expect.poll(async () => [...new Set(await sizes())]).toEqual([size])
  await expect.poll(async () => (await pendingValues(page, "256.2")).length).toBe(1)
  await page.getByRole("button", { name: "Undo text edit", exact: true }).click()
  await expect(editor).toHaveText("Hello")
  await expect(words).toHaveText("Hello")
  await words.click()
  await words.press("ControlOrMeta+a")
  await page.keyboard.insertText("Kept")
  await words.blur()
  await expect(editor).toHaveText("Kept")
  await page.reload()
  await settled(page)
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Kept")
})
