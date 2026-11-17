import { openFillDetails } from "./design-panel"
import { expect, test, type Locator } from "@playwright/test"
import { designing, openDeck, unfold } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

function field(panel: Locator, name: string): Locator {
  return panel.getByRole("textbox", { name, exact: true })
}

function inherited(box: Locator): Promise<boolean> {
  return box.evaluate((input) => input.closest("label")?.hasAttribute("data-inherited") ?? false)
}

function ink(box: Locator): Promise<string> {
  return box.evaluate((input) => getComputedStyle(input).color)
}

test("a title shows the size, font and spacing it paints with as inherited, and a size it sets as its own until Undo", async ({
  page,
}) => {
  await openDeck(page, "doe-heat-pumps.pptx")
  await page.locator('[data-slide-entry="12"]').click()
  const title = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide12.xml#2"]')
  const panel = await designing(page, title)
  const size = field(panel, "Font size")
  const font = field(panel, "Font")
  const spacing = field(panel, "Line spacing")
  await expect(size).toHaveValue("44")
  await expect(font).toHaveValue("Calibri Light")
  await expect(spacing).toHaveValue("90")
  expect(await Promise.all([size, font, spacing].map(inherited))).toEqual([true, true, true])
  const quiet = await ink(size)
  await size.fill("40")
  await size.press("Enter")
  await expect(size).toHaveValue("40")
  await expect.poll(() => inherited(size)).toBe(false)
  expect(await ink(size)).not.toBe(quiet)
  await page
    .getByRole("button", { name: /^Undo / })
    .first()
    .click()
  await expect(size).toHaveValue("44")
  await expect.poll(() => inherited(size)).toBe(true)
  expect(await ink(size)).toBe(quiet)
})

test("a margin the text box inherits is quiet until set, and Reset fill shows the inherited fill again", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const panel = await designing(page, page.locator('[data-slide-paint] [contenteditable="true"]'))
  await unfold(panel, "Text box")
  const left = panel.getByRole("group", { name: "Margins", exact: true }).getByRole("textbox", { name: "Left" })
  await expect(left).toHaveValue("7.2")
  await expect.poll(() => inherited(left)).toBe(true)
  await left.fill("36")
  await left.press("Enter")
  await expect(left).toHaveValue("36")
  await expect.poll(() => inherited(left)).toBe(false)
  const fill = panel.locator('[data-control="union"]').first()
  await expect(fill).not.toHaveAttribute("data-inherited")
  await openFillDetails(panel)
  await panel.getByRole("button", { name: "Reset fill", exact: true }).click()
  await expect(fill).toHaveAttribute("data-inherited", "")
  await expect(panel.getByRole("button", { name: "Reset fill", exact: true })).toHaveCount(0)
})
