import { expect } from "@playwright/test"

export async function placeText(page, at = { x: 0.3, y: 0.3 }) {
  const tool = page.getByRole("button", { name: "Add text", exact: true })
  if ((await tool.getAttribute("aria-pressed")) !== "true") await tool.click()
  const placing = page.locator("[data-text-placing]")
  await expect(placing).toBeVisible()
  const box = await placing.boundingBox()
  if (box === null) throw new Error("text placing")
  await placing.click({ position: { x: box.width * at.x, y: box.height * at.y } })
}
