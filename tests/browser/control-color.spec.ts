import { expect, test } from "@playwright/test"
import { designing, openDeck, pendingValues, settled } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a colour sets the text of the whole element to a theme colour, and Undo puts the colour back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const colors = panel.getByRole("group", { name: "Text color" })
  const run = editor.locator("[data-run]").first()
  await expect(colors.getByRole("button")).toHaveCount(10)
  await expect(colors.getByRole("button", { name: "Dark 1", exact: true })).toHaveAttribute("aria-pressed", "true")
  await colors.getByRole("button", { name: "Accent 2", exact: true }).click()
  await expect(run).toHaveAttribute("data-color", "scheme:accent2")
  await expect(colors.getByRole("button", { name: "Accent 2", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(colors.getByRole("button", { name: "Dark 1", exact: true })).toHaveAttribute("aria-pressed", "false")
  await expect
    .poll(async () => (await pendingValues(page, "256.2")).map(String).join())
    .toContain('"color":{"scheme":"accent2"}')
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect(run).not.toHaveAttribute("data-color")
  await expect(colors.getByRole("button", { name: "Dark 1", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await expect(run).toHaveAttribute("data-color", "scheme:accent2")
  await page.reload()
  await settled(page)
  await expect(page.locator("[data-slide-paint] [data-run]").first()).toHaveAttribute("data-color", "scheme:accent2")
})
