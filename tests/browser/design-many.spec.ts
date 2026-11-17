import { expect, test } from "@playwright/test"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { effectsCopy } from "../../apps/web/src/copy/effects-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck, unfold, pickColor, shownColor } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("two selected shapes share one panel that reads Mixed, a colour picked there fills both, and one Undo puts both back", async ({
  page,
}) => {
  await openDeck(page, "shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const oval = shapeAt(page, "5")
  const accentOne = await filled(oval)
  const alone = await fillPanel(page, rectangle)
  await pickColor(page, alone.getByRole("group", { name: fillWords.color, exact: true }), formatCopy.colors.accent2)
  await expect.poll(() => filled(rectangle)).not.toBe(accentOne)
  const accentTwo = await filled(rectangle)

  await oval.click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", /^\d+\.4 \d+\.5$/)
  await expect(panel).toContainText(designCopy.elements(2))
  await expect(panel.getByRole("heading")).toHaveText([
    fillCopy.value,
    shapeCopy.line,
    opacityCopy.label,
    boxCopy.section,
    effectsCopy.section,
  ])
  await unfold(panel, boxCopy.section)
  await expect(panel.getByRole("textbox", { name: boxCopy.x, exact: true })).toHaveAttribute(
    "placeholder",
    designCopy.mixed,
  )
  const kinds = panel.getByRole("group", { name: fillCopy.value, exact: true })
  await expect(kinds.getByRole("button", { name: fillWords.color, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const colors = panel.getByRole("group", { name: fillWords.color, exact: true })
  await expect(shownColor(colors)).toHaveText(designCopy.mixed)

  await pickColor(page, colors, formatCopy.colors.accent6)
  await expect.poll(() => filled(oval)).not.toBe(accentOne)
  const accentSix = await filled(oval)
  await expect.poll(() => filled(rectangle)).toBe(accentSix)
  await expect(shownColor(colors)).toHaveText(formatCopy.colors.accent6)

  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(accentTwo)
  await expect.poll(() => filled(oval)).toBe(accentOne)
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(accentOne)
})
