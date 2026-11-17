import { expect, test } from "@playwright/test"
import { designing, openDeck, settled } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a choice aligns every paragraph of the element, shows the pick, and Undo puts the alignment back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const alignment = panel.getByRole("group", { name: "Alignment", exact: true })
  const aligned = () =>
    editor
      .locator("[data-paragraph]")
      .first()
      .evaluate((node) => getComputedStyle(node).textAlign)
  for (const [at, name] of ["Left", "Center", "Right"].entries()) {
    await expect(alignment.getByRole("button").nth(at)).toHaveAccessibleName(name)
    await expect(alignment.getByRole("button").nth(at)).toHaveAttribute("title", name)
  }
  await expect.poll(aligned).toBe("left")
  await alignment.getByRole("button", { name: "Center", exact: true }).click()
  await expect.poll(aligned).toBe("center")
  await expect(alignment.getByRole("button", { name: "Center", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(aligned).toBe("left")
  await expect(alignment.getByRole("button", { name: "Center", exact: true })).toHaveAttribute("aria-pressed", "false")
  await alignment.getByRole("button", { name: "Right", exact: true }).click()
  await expect.poll(aligned).toBe("right")
  await page.reload()
  await settled(page)
  await expect
    .poll(() =>
      page
        .locator('[data-slide-paint] [contenteditable="true"] [data-paragraph]')
        .first()
        .evaluate((node) => getComputedStyle(node).textAlign),
    )
    .toBe("right")
})
