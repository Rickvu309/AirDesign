import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { effectsCopy } from "../../apps/web/src/copy/effects-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { selectionColorsCopy } from "../../apps/web/src/copy/selection-colors-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { colorWords } from "./color-words"
import { openDeck, unfold, setPanelMode, pickColor, shownColor } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("two selected shapes share one panel that reads Mixed, a colour picked there fills both, and one Undo puts both back", async ({
  page,
}) => {
  await openDeck(page, "shapes-added.pptx")
  const names = await colorWords("shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const oval = shapeAt(page, "5")
  const accentOne = await filled(oval)
  const alone = await fillPanel(page, rectangle)
  await pickColor(page, alone.getByRole("group", { name: fillWords.color, exact: true }), names.accent2)
  await expect.poll(() => filled(rectangle)).not.toBe(accentOne)
  const accentTwo = await filled(rectangle)

  await oval.click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", /^\d+\.4 \d+\.5$/)
  await expect(panel).toContainText(designCopy.selected(2))
  await setPanelMode(page, "slides")
  await expect(panel.getByRole("heading")).toHaveText([
    fillCopy.value,
    opacityCopy.label,
    designCopy.border,
    designCopy.shadow,
    selectionColorsCopy.section,
  ])
  await unfold(panel, boxCopy.section)
  await expect(panel.getByRole("heading")).toHaveText([
    fillCopy.value,
    opacityCopy.label,
    designCopy.border,
    designCopy.shadow,
    selectionColorsCopy.section,
    boxCopy.section,
    effectsCopy.section,
    designCopy.fillDetails,
  ])
  await expect(panel.getByRole("textbox", { name: boxCopy.x, exact: true })).toHaveAttribute(
    "placeholder",
    designCopy.mixed,
  )
  const kinds = panel.getByRole("group", { name: fillCopy.value, exact: true })
  await expect(kinds.getByRole("button", { name: fillWords.solid, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const colors = panel.getByRole("group", { name: fillWords.color, exact: true })
  await expect(shownColor(colors)).toHaveText(designCopy.mixed)

  await pickColor(page, colors, names.accent6)
  await expect.poll(() => filled(oval)).not.toBe(accentOne)
  const accentSix = await filled(oval)
  await expect.poll(() => filled(rectangle)).toBe(accentSix)
  await expect(shownColor(colors)).toHaveText(names.accent6)

  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(accentTwo)
  await expect.poll(() => filled(oval)).toBe(accentOne)
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => filled(rectangle)).toBe(accentOne)
})

test("replaces two text boxes in one undo step and keeps each box's formatting", async ({ page }) => {
  await openDeck(page, "element-added.pptx")
  const first = shapeAt(page, "2")
  const second = shapeAt(page, "3")
  const runs = [first.locator("[data-run]").first(), second.locator("[data-run]").first()]

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await first.click({ position: { x: 4, y: 4 } })
  await second.click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("button", { name: designCopy.multiEditText, exact: true }).click()
  const field = page.getByRole("textbox", { name: designCopy.multiEditText })
  await expect(field).toHaveAttribute("placeholder", designCopy.mixed)
  const styles = await Promise.all(runs.map((run) => run.evaluate((el) => getComputedStyle(el).fontSize)))
  expect(new Set(styles).size).toBe(2)
  await field.fill("Discard this")
  await field.press("Escape")
  await expect(field).toHaveValue("")
  await field.fill("Shared footer")
  await field.press("ControlOrMeta+Enter")
  await expect(first).toHaveText("Shared footer")
  await expect(second).toHaveText("Shared footer")
  for (const [at, run] of runs.entries()) await expect(run).toHaveCSS("font-size", styles[at] ?? "")

  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect(first).toHaveText("Hello")
  await expect(second).toHaveText("Added text")
  await page.getByRole("button", { name: undoCopy.redoNamed.text, exact: true }).click()
  await expect(second).toHaveText("Shared footer")
  await page.reload()
  await expect(first).toHaveText("Shared footer")
  await expect(second).toHaveText("Shared footer")
})
