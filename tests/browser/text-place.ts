import { expect, type Page } from "@playwright/test"

export type SlideSpot = { readonly x: number; readonly y: number }

export async function placeText(page: Page, at: SlideSpot = { x: 0.3, y: 0.3 }): Promise<void> {
  const tool = page.getByRole("button", { name: "Add text", exact: true })
  if ((await tool.getAttribute("aria-pressed")) !== "true") await tool.click()
  const placing = page.locator("[data-text-placing]")
  await expect(placing).toBeVisible()
  const box = await placing.boundingBox()
  if (box === null) throw new Error("text placing")
  await placing.click({ position: { x: box.width * at.x, y: box.height * at.y } })
}
