import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.setViewportSize({ width: 735, height: 800 })
  await kit.page.goto("/")
  await expect(kit.page.getByRole("heading", { name: "Recents", level: 1 })).toBeVisible()
}

export default { name: "home-zoomed", design: null, drive }
