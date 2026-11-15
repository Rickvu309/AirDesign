import { expect, type Locator, type Page } from "@playwright/test"
import { unfold } from "./design-panel"

export function turned(shape: Locator): Promise<string> {
  return shape.evaluate((node: HTMLElement) => node.style.transform)
}

export function outline(shape: Locator): Promise<string> {
  return shape.evaluate((node) =>
    [...node.querySelectorAll("[data-canvas-line] g path")].map((path) => path.getAttribute("d")).join(" | "),
  )
}

export async function shapePanel(page: Page, shape: Locator): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await shape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await unfold(panel, "Shape type")
  await expect(panel.getByRole("combobox", { name: "Type", exact: true })).toBeVisible()
  return panel
}

export async function pickShape(page: Page, panel: Locator, name: string): Promise<void> {
  await panel.getByRole("combobox", { name: "Type", exact: true }).click()
  await page.getByRole("option", { name, exact: true }).click()
  await expect(panel.getByRole("combobox", { name: "Type", exact: true })).toHaveText(new RegExp(`^${name}`))
}
