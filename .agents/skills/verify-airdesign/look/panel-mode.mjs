import { expect } from "@playwright/test"

export async function setPanelMode(page, mode) {
  const toggle = page.locator("[data-design-mode]")
  const pressed = mode === "design" ? "true" : "false"
  if ((await toggle.getAttribute("aria-pressed")) !== pressed) await toggle.click()
  await expect(toggle).toHaveAttribute("aria-pressed", pressed)
}
