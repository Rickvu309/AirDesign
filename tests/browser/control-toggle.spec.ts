import { expect, test, type Locator } from "@playwright/test"
import { designing, openDeck, pendingValues, settled } from "./design-panel"
import { holdableDevice } from "./slow-device"

function looks(run: Locator): Promise<string[]> {
  return run.evaluate((node) => {
    const style = getComputedStyle(node)
    return [style.fontWeight, style.fontStyle, style.textDecorationLine]
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a toggle makes the whole element bold and italic, each change is one undo step, and a reload keeps it", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const bold = panel.getByRole("button", { name: "Bold", exact: true })
  const italic = panel.getByRole("button", { name: "Italic", exact: true })
  const run = editor.locator("[data-run]").first()
  await expect(bold).toHaveAttribute("aria-pressed", "false")
  await bold.click()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await expect(bold).toHaveAttribute("aria-pressed", "true")
  await italic.click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  await expect
    .poll(async () => (await pendingValues(page, "256.2")).map(String).join())
    .toContain('"bold":true,"italic":true')
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await expect(italic).toHaveAttribute("aria-pressed", "false")
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  await page.reload()
  await settled(page)
  await expect.poll(() => looks(editor.locator("[data-run]").first())).toEqual(["700", "italic", "none"])
})

test("toggles clicked one after another on a slow device all land, each its own undo step", async ({ page }) => {
  await holdableDevice(page)
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const run = editor.locator("[data-run]").first()
  await page.evaluate(() => {
    window.deviceDelay = 300
  })
  await panel.getByRole("button", { name: "Bold", exact: true }).click()
  await panel.getByRole("button", { name: "Italic", exact: true }).click()
  await panel.getByRole("button", { name: "Underline", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "underline"])
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
})
