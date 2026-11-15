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
  await expect(panel).toContainText(/^Text box/)
  await expect(panel.getByRole("heading")).toHaveText([
    "Text",
    "Position and size",
    "Fill",
    "Opacity",
    "Line",
    "Effects",
    "Text box",
    "Shape type",
    "Name and alt text",
  ])
  await expect(fold(panel, "Text")).toHaveAttribute("aria-expanded", "true")
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
  await fold(panel, "Position and size").click()
  await expect(fold(panel, "Position and size")).toHaveAttribute("aria-expanded", "false")

  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name: "Rectangle", exact: true }).click()
  const shape = page.locator("[data-design-element]")
  await expect(shape).toContainText(/^Shape/)
  await expect(shape.getByRole("heading")).toHaveText([
    "Fill",
    "Line",
    "Shape type",
    "Position and size",
    "Opacity",
    "Effects",
    "Name and alt text",
  ])
  await expect(fold(shape, "Effects")).toHaveAttribute("aria-expanded", "false")
  await expect(fold(shape, "Position and size")).toHaveAttribute("aria-expanded", "true")

  const back = await pick(page, shapeAt(page, "2"))
  await expect(back).toContainText(/^Text box/)
  await expect(fold(back, "Effects")).toHaveAttribute("aria-expanded", "true")
  await expect(fold(back, "Position and size")).toHaveAttribute("aria-expanded", "false")

  await page.reload()
  await settled(page)
  const again = await designing(page, shapeAt(page, "2"))
  await expect(fold(again, "Effects")).toHaveAttribute("aria-expanded", "true")
  await expect(fold(again, "Position and size")).toHaveAttribute("aria-expanded", "false")
})
