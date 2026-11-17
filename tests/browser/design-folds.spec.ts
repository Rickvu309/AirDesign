import { effectsCopy } from "../../apps/web/src/copy/effects-copy"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { geometryCopy } from "../../apps/web/src/copy/geometry-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { selectionColorsCopy } from "../../apps/web/src/copy/selection-colors-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { designing, openDeck, settled, setPanelMode } from "./design-panel"
import { shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

function fold(panel: Locator, title: string): Locator {
  return panel.getByRole("heading", { name: title, exact: true }).getByRole("button")
}

async function pick(page: Page, element: Locator): Promise<Locator> {
  await element.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  return panel
}

test("a text box's panel leads with Text and folds its rare sections, and a person's folding stays for that kind of element", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const panel = await designing(page, shapeAt(page, "2"))
  await expect(panel).toContainText(designCopy.panels.text)
  await expect(panel.locator("section").first().getByRole("group", { name: boxCopy.align, exact: true })).toBeVisible()
  await expect(page.locator("[data-design-mode]")).toHaveAttribute("aria-pressed", "false")
  await expect(panel.locator("[data-design-head]")).toHaveText(designCopy.titles.text)
  await expect(panel.getByRole("heading", { name: textCopy.section, exact: true })).toHaveCount(0)
  await expect(panel.getByRole("heading")).toHaveText([linkCopy.section, fillCopy.section, opacityCopy.label])
  await expect(fold(panel, fillCopy.section)).toHaveCount(0)
  await setPanelMode(page, "design")
  await expect(panel.getByRole("heading")).toHaveText([
    linkCopy.section,
    fillCopy.section,
    opacityCopy.label,
    fillCopy.box,
    textCopy.paragraphSpacing,
    boxCopy.section,
    "Line",
    effectsCopy.section,
    designCopy.panels.text,
    geometryCopy.shape,
    "Name and alt text",
    selectionColorsCopy.section,
  ])
  await expect(fold(panel, fillCopy.section)).toHaveCount(0)
  await expect(fold(panel, effectsCopy.section)).toHaveAttribute("aria-expanded", "false")
  await expect(panel.getByRole("group", { name: "Shadow", exact: true })).toHaveCount(0)

  await fold(panel, "Line").focus()
  await page.keyboard.press("Tab")
  await expect(fold(panel, effectsCopy.section)).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(fold(panel, effectsCopy.section)).toHaveAttribute("aria-expanded", "true")
  const controlled = await fold(panel, effectsCopy.section).getAttribute("aria-controls")
  expect(controlled).not.toBeNull()
  await expect(
    page.locator(`[id="${controlled ?? ""}"]`).getByRole("group", { name: "Shadow", exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Space")
  await expect(fold(panel, effectsCopy.section)).toHaveAttribute("aria-expanded", "false")
  await page.keyboard.press("Space")
  await expect(fold(panel, boxCopy.section)).toHaveAttribute("aria-expanded", "false")
  await fold(panel, boxCopy.section).click()
  await expect(fold(panel, boxCopy.section)).toHaveAttribute("aria-expanded", "true")

  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name: "Rectangle", exact: true }).click()
  const shape = page.locator("[data-design-element]")
  await expect(shape.locator("[data-design-head]")).toHaveText(designCopy.square)
  await expect(shape.getByRole("heading")).toHaveText([
    fillCopy.section,
    opacityCopy.label,
    geometryCopy.corners,
    designCopy.border,
    designCopy.shadow,
    selectionColorsCopy.section,
    geometryCopy.shape,
    "Line",
    effectsCopy.section,
    boxCopy.section,
    "Name and alt text",
    designCopy.fillDetails,
  ])
  await expect(fold(shape, effectsCopy.section)).toHaveAttribute("aria-expanded", "false")
  await expect(fold(shape, boxCopy.section)).toHaveAttribute("aria-expanded", "false")

  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(page.locator("[data-design-mode]")).toHaveAttribute("aria-pressed", "true")
  const back = await pick(page, shapeAt(page, "2"))
  await expect(back).toContainText(designCopy.panels.text)
  await expect(fold(back, effectsCopy.section)).toHaveAttribute("aria-expanded", "true")
  await expect(fold(back, boxCopy.section)).toHaveAttribute("aria-expanded", "true")

  await page.reload()
  await settled(page)
  const again = await designing(page, shapeAt(page, "2"))
  await expect(page.locator("[data-design-mode]")).toHaveAttribute("aria-pressed", "false")
  await expect(fold(again, effectsCopy.section)).toHaveCount(0)
  await setPanelMode(page, "design")
  await expect(fold(again, effectsCopy.section)).toHaveAttribute("aria-expanded", "true")
  await expect(fold(again, boxCopy.section)).toHaveAttribute("aria-expanded", "true")
})

test("a connector keeps the extra Opacity control in a closed section", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const box = await shapeAt(page, "6").boundingBox()
  if (box === null) throw new Error("connector")
  await page.mouse.click(box.x + box.width / 2, box.y)
  const panel = page.locator("[data-design-element]")
  await setPanelMode(page, "slides")
  await expect(panel.getByRole("heading", { name: opacityCopy.label })).toHaveCount(0)
  await setPanelMode(page, "design")
  await expect(fold(panel, opacityCopy.label)).toHaveAttribute("aria-expanded", "false")
  await fold(panel, opacityCopy.label).click()
  await expect(panel.getByRole("textbox", { name: opacityCopy.label, exact: true })).toBeVisible()
})
