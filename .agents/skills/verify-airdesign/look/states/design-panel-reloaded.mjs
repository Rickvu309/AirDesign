import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
  await kit.page.reload()
  await kit.page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
}

export default { name: "design-panel-reloaded", design: "/screens/s43-02-editor-tools-design-panel", drive }
