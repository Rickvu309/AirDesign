import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { geometryCopy } from "../../apps/web/src/copy/geometry-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { selectionColorsCopy } from "../../apps/web/src/copy/selection-colors-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { designing, openDeck, settled } from "./design-panel"
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
  await expect(panel.getByRole("heading")).toHaveText([
    linkCopy.section,
    "Fill",
    opacityCopy.label,
    fillCopy.box,
    boxCopy.section,
    "Line",
    "Effects",
    designCopy.panels.text,
    "Shape type",
    "Name and alt text",
    selectionColorsCopy.section,
  ])
  await expect(panel.locator("[data-design-head]")).toHaveText(designCopy.titles.text)
  await expect(fold(panel, fillCopy.section)).toHaveCount(0)
  await expect(fold(panel, "Effects")).toHaveAttribute("aria-expanded", "false")
  await expect(panel.getByRole("group", { name: "Shadow", exact: true })).toHaveCount(0)

  await fold(panel, "Line").focus()
  await page.keyboard.press("Tab")
  await expect(fold(panel, "Effects")).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(fold(panel, "Effects")).toHaveAttribute("aria-expanded", "true")
  const controlled = await fold(panel, "Effects").getAttribute("aria-controls")
  expect(controlled).not.toBeNull()
  await expect(
    page.locator(`[id="${controlled ?? ""}"]`).getByRole("group", { name: "Shadow", exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Space")
  await expect(fold(panel, "Effects")).toHaveAttribute("aria-expanded", "false")
  await page.keyboard.press("Space")
  await expect(fold(panel, boxCopy.section)).toHaveAttribute("aria-expanded", "false")
  await fold(panel, boxCopy.section).click()
  await expect(fold(panel, boxCopy.section)).toHaveAttribute("aria-expanded", "true")

  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name: "Rectangle", exact: true }).click()
  const shape = page.locator("[data-design-element]")
  await expect(shape.locator("[data-design-head]")).toHaveText(designCopy.square)
  await expect(shape.getByRole("heading")).toHaveText([
    "Fill",
    opacityCopy.label,
    geometryCopy.corners,
    designCopy.border,
    designCopy.shadow,
    "Shape type",
    "Line",
    "Effects",
    boxCopy.section,
    "Name and alt text",
    selectionColorsCopy.section,
  ])
  await expect(fold(shape, "Effects")).toHaveAttribute("aria-expanded", "false")
  await expect(fold(shape, boxCopy.section)).toHaveAttribute("aria-expanded", "false")

  const back = await pick(page, shapeAt(page, "2"))
  await expect(back).toContainText(designCopy.panels.text)
  await expect(fold(back, "Effects")).toHaveAttribute("aria-expanded", "true")
  await expect(fold(back, boxCopy.section)).toHaveAttribute("aria-expanded", "true")

  await page.reload()
  await settled(page)
  const again = await designing(page, shapeAt(page, "2"))
  await expect(fold(again, "Effects")).toHaveAttribute("aria-expanded", "true")
  await expect(fold(again, boxCopy.section)).toHaveAttribute("aria-expanded", "true")
})

test("a connector keeps the extra Opacity control in a closed section", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const box = await shapeAt(page, "6").boundingBox()
  if (box === null) throw new Error("connector")
  await page.mouse.click(box.x + box.width / 2, box.y)
  const panel = page.locator("[data-design-element]")
  await expect(fold(panel, opacityCopy.label)).toHaveAttribute("aria-expanded", "false")
  await fold(panel, opacityCopy.label).click()
  await expect(panel.getByRole("textbox", { name: opacityCopy.label, exact: true })).toBeVisible()
})
