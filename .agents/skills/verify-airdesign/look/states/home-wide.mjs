import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await kit.page.setViewportSize({ width: 1920, height: 1080 })
  await listDecks(kit)
  await kit.page.goto("/")
  await expect(kit.page.getByRole("heading", { name: "Recents", level: 1 })).toBeVisible()
}

export default { name: "home-wide", design: null, drive }
